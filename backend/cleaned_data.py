from fredapi import Fred
import pandas as pd
import numpy as np
from statsmodels.tsa.stattools import adfuller

API_KEY = "9dbad5d2ff8d714e70fc0d4f94b923b9"
fred = Fred(api_key = API_KEY)

series_ids = ['BAA', 'AAA', 'INDPRO', 'RPI', 'INVEST', 'UNRATE', 'GS10', 'TB3MS', 'CPIAUCSL']
#RSXFS: Advance Retail Sales: Retail Trade (millions)
#VIXCLS starts in 1990-01, need to aggregate to monthly too
#added UNRATE
#remove VIXCLS for now
#remove RSXFS for now
#removed UMCSENT
#added CPIAUCSL

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
fred_data_filtered= fred_data_filtered.ffill()
fred_data_filtered

#function for checking of stationarity with alpha 0.5
def check_stationarity(series, alpha=0.05):
    result = adfuller(series)
    p_value = result[1]
    if p_value < alpha:
        print(f"{series.name} is stationary (p-value: {p_value})")
    else:
        print(f"{series.name} is non-stationary (p-value: {p_value})")


# Check stationarity for each column in the dataframe
for column in fred_data.columns:
    check_stationarity(fred_data_filtered[column])

#transformations required
#BAA, AAA, UNRATE, GS10, TB3MS: 2
#RPI, INDPRO: 5
#INVEST, CPIAUCSL: 6

fred_data_transformed = pd.DataFrame()
#apply transformation code 2
fred_data_transformed['BAA'] = fred_data_filtered['BAA'].diff()
fred_data_transformed['AAA'] = fred_data_filtered['AAA'].diff()
fred_data_transformed['UNRATE'] = fred_data_filtered['UNRATE'].diff()
fred_data_transformed['GS10'] = fred_data_filtered['GS10'].diff()
fred_data_transformed['TB3MS'] = fred_data_filtered['TB3MS'].diff()

#apply transformation code 5
fred_data_filtered['RPI'] = np.log(fred_data_filtered['RPI'])
fred_data_transformed['RPI'] = fred_data_filtered['RPI'].diff()

fred_data_filtered['INDPRO'] = np.log(fred_data_filtered['INDPRO'])
fred_data_transformed['INDPRO'] = fred_data_filtered['INDPRO'].diff()

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

#import GDP and transform
GDP_Q = pd.DataFrame(fred.get_series("GDPC1"))
GDP_Q_diff = GDP_Q.diff().dropna()

GDP_M = GDP_Q_diff.resample('MS').ffill()
GDP_M.rename(columns = {0: 'GDPC1'}, inplace = True)

final_data = pd.merge(fred_data_transformed, GDP_M, left_index=True, right_index=True, how='left')
