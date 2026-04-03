from fredapi import Fred
import pandas as pd
import numpy as np
import statsmodels.api as sm
from dotenv import load_dotenv
import os
from pathlib import Path
from statsmodels.tsa.stattools import adfuller

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

#API_KEY = os.getenv("FRED_API_KEY")
##change to use env before submit!
API_KEY = "9dbad5d2ff8d714e70fc0d4f94b923b9"
fred = Fred(api_key = API_KEY)

if not API_KEY:
    raise ValueError("Missing FRED_API_KEY in .env")

series_ids = ['BAA', 'AAA', 'INDPRO', 'RPI', 'INVEST', 'UNRATE', 'GS10', 'TB3MS', 'CPIAUCSL', 'HOUST']
#RSXFS: Advance Retail Sales: Retail Trade (millions)
#VIXCLS starts in 1990-01, need to aggregate to monthly too
#added UNRATE
#remove VIXCLS for now
#remove RSXFS for now
#removed UMCSENT
#added CPIAUCSL
#added HOUST

#set up data
fred_data = pd.DataFrame()
for series_id in series_ids:
    series_data = fred.get_series(series_id)

    series_df = pd.DataFrame(series_data)
    series_df.rename(columns={0: series_id}, inplace=True)
    if fred_data.empty:
        fred_data = series_df
    else:
        fred_data = pd.merge(fred_data, series_df, left_index=True, right_index=True, how="outer")

fred_data_filtered = fred_data[fred_data.index >= '1959-01-01' ]
fred_data_filtered= fred_data_filtered.interpolate(method="linear")
fred_data_filtered

#function for checking of stationarity with alpha 0.5
def check_stationarity(series, alpha=0.05):
    result = adfuller(series.dropna())
    p_value = result[1]
    if p_value < alpha:
        print(f"{series.name} is stationary (p-value: {p_value})")
    else:
        print(f"{series.name} is non-stationary (p-value: {p_value})")

#transformations required
#BAA, AAA, UNRATE, GS10, TB3MS: 2
#RPI, INDPRO: 5
#INVEST, CPIAUCSL: 6
#HOUST: 4

fred_data_transformed = pd.DataFrame()
#apply transformation code 2
fred_data_transformed['BAA'] = fred_data_filtered['BAA'].diff()
fred_data_transformed['AAA'] = fred_data_filtered['AAA'].diff()
fred_data_transformed['UNRATE'] = fred_data_filtered['UNRATE'].diff()
fred_data_transformed['GS10'] = fred_data_filtered['GS10'].diff()
fred_data_transformed['TB3MS'] = fred_data_filtered['TB3MS'].diff()

#apply transformation for code 4; i decided to use log differencing
fred_data_transformed['HOUST'] = np.log(fred_data_filtered['HOUST'])
fred_data_transformed['HOUST'] = fred_data_transformed['HOUST'].diff()


#apply transformation code 5
fred_data_transformed['RPI'] = np.log(fred_data_filtered['RPI'])
fred_data_transformed['RPI'] = fred_data_transformed['RPI'].diff()

fred_data_transformed['INDPRO'] = np.log(fred_data_filtered['INDPRO'])
fred_data_transformed['INDPRO'] = fred_data_transformed['INDPRO'].diff()

#apply transformation code 6
fred_data_transformed['INVEST'] = np.log(fred_data_filtered['INVEST'])
fred_data_transformed['INVEST'] = fred_data_transformed['INVEST'].diff().diff()

fred_data_transformed['CPIAUCSL'] = np.log(fred_data_filtered['CPIAUCSL'])
fred_data_transformed['CPIAUCSL'] = fred_data_transformed['CPIAUCSL'].diff().diff()


fred_data_transformed = fred_data_transformed[fred_data_transformed.index >= '1959-04-01' ]
#removed some months due to NaNs...

#check that transformed data is stationary
for column in fred_data_transformed.columns:
    check_stationarity(fred_data_transformed[column])

#function to check how many months to fill using AR model
def months_to_quarter_end(date):
    """Return number of months from date to the end of its quarter."""
    m = date.month
    if m in [1, 2]:
        return 3 - m
    elif m in [4, 5]:
        return 6 - m
    elif m in [7, 8]:
        return 9 - m
    elif m in [10, 11]:
        return 12 - m
    else:
        return 0

#function to fit AR(2) model
def predictor_model(series, h):
    s = pd.to_numeric(series, errors="coerce").dropna()

    df_model = pd.DataFrame({
        "y_t": s,
        "lag1": s.shift(1),
        "target": s.shift(-h)
    }).dropna()

    X = sm.add_constant(df_model[["y_t", "lag1"]])
    y = df_model["target"]

    model = sm.OLS(y, X).fit()
    return model

#function to fill up missing dates
def fill_values(df):
    df = df.copy()
    df.index = pd.to_datetime(df.index)

    filled_df = df.copy()

    for col in df.columns:
        s = df[col].copy()
        observed = pd.to_numeric(s, errors="coerce").dropna()

        if len(observed) < 10:
            continue

        last_date = observed.index[-1]
        h_max = months_to_quarter_end(last_date)

        if h_max == 0:
            continue

        for h in range(1, h_max + 1):
            model = predictor_model(observed, h=h)

            X_new = pd.DataFrame({
                "const": [1.0],
                "y_t": [observed.iloc[-1]],
                "lag1": [observed.iloc[-2]]
            })

            pred = model.predict(X_new).iloc[0]
            forecast_date = last_date + pd.DateOffset(months=h)

            filled_df.loc[forecast_date, col] = pred

    return filled_df.sort_index()

filled_df = fill_values(fred_data_transformed)

#aggregate variables into quarterly
Var_Q = filled_df.resample("QS").mean()

#import GDP and transform
GDP_Q = pd.DataFrame(fred.get_series("GDPC1"))
GDP_Q.rename(columns = {0: 'GDPC1'}, inplace = True)
#log differencing and multiply 400
GDP_Q_diff = 400*(np.log(GDP_Q).diff().dropna())

GDP_M = GDP_Q_diff.resample('MS').ffill()

#quarterly data with variables aggregated by mean
Quarterly_Data = pd.merge(Var_Q, GDP_Q_diff, left_index=True, right_index=True, how='left')

#monthly data with GDPC1 filled up by forward fill
Monthly_Data = pd.merge(fred_data_transformed, GDP_M, left_index=True, right_index=True, how='left')

#adding Covid variable
Monthly_Data["Covid"] = ((Monthly_Data.index >= "2020-03-01") & (Monthly_Data.index <= "2021-12-01")).astype(int)
Quarterly_Data["Covid"] = ((Quarterly_Data.index >= "2020-01-01") & (Quarterly_Data.index <= "2021-12-01")).astype(int)

def get_quarterly_data():
    return Quarterly_Data
def get_monthly_data():
    return Monthly_Data

### RANDOM FOREST DATA ###
### Used data that was not differenciated, random forest performs with economic noise ###
### used a hybrid model, refer to random_forest_model.py for details ###

filled_raw = fill_values(fred_data_filtered) 
Var_Q_raw = filled_raw.resample("QS").mean()
Quarterly_RF = pd.merge(Var_Q_raw, GDP_Q_diff, left_index=True, right_index=True, how='left')
Quarterly_RF["Covid"] = ((Quarterly_RF.index >= "2020-01-01") & (Quarterly_RF.index <= "2021-12-01")).astype(int)
Quarterly_RF["SARS"] = ((Quarterly_RF.index >= "2003-03-01") & (Quarterly_RF.index <= "2003-07-01")).astype(int)
last_date = fred_data_filtered.index.max()
months_missing = months_to_quarter_end(last_date)

def get_quarterly_data_rf():
    return Quarterly_RF

print(filled_raw.tail(10))
print(Monthly_Data.tail(10))
print(fred_data.tail(10))
