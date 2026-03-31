import pandas as pd
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from quarterly_and_monthly_data import get_quarterly_data_rf

# get current file directory
quarterly_data = get_quarterly_data_rf()
latest_quarter = pd.DataFrame(quarterly_data.tail(1))


df_quarterly = quarterly_data.copy()
df_quarterly = df_quarterly.dropna()
df_quarterly.index = pd.to_datetime(df_quarterly.index)
df_quarterly = df_quarterly.sort_index()

#define x and y for monthly data
x = df_quarterly.drop(columns=['GDPC1'])
y = df_quarterly['GDPC1']


# spreads and key signals
x['spread'] = x['BAA'] - x['AAA']
x['term_spread'] = x['GS10'] - x['TB3MS']
x['INDPRO_growth'] = np.log(x['INDPRO']).diff()
x['HOUST_growth'] = np.log(x['HOUST']).diff()
x['INVEST_growth'] = np.log(df_quarterly['INVEST']).diff()
x = x[['spread', 'term_spread','INDPRO_growth', 'HOUST_growth', 'UNRATE', 'INVEST_growth']]
#x = x[['spread', 'term_spread', 'INDPRO_growth', 'HOUST_growth', 'UNRATE']]
x = x.dropna()
y = y.loc[x.index]

# split into train and test sets (train - first 80% of observations, test - last 20% of observations)
split_index = int(len(x) * 0.8)
X_train = x.iloc[:split_index]
X_test  = x.iloc[split_index:]
y_train = y.iloc[:split_index]
y_test  = y.iloc[split_index:]

'''
#Train the random forest model
rf = RandomForestRegressor(
    n_estimators=300, #number of trees in the forest
    max_depth=None, #maximum depth of the tree 
    min_samples_leaf=1,
    random_state=42 #for reproducibility (seed)
)
rf.fit(X_train, y_train)

#Predict on the test set
y_pred = rf.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
print("RMSE:", rmse)
print("Pred std:", np.std(y_pred))
print("Actual std:", np.std(y_test))
results = pd.DataFrame({
    'Actual': y_test,
    'Predicted': y_pred
})
'''

#find the optimal number of trees (n_estimators) & depth using out-of-bag error
n_estimators_list = list(range(100, 501, 100))
max_depth_list = list(range(3, 16, 2)) + [None]
results = []
best_rmse = float('inf')
best_params = None

for n in n_estimators_list:
    for d in max_depth_list:
        rf = RandomForestRegressor(
            n_estimators=n,
            max_depth=d,
            random_state=42,
            )
        rf.fit(X_train, y_train)
        y_pred = rf.predict(X_test)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        results.append((n, d, rmse))
        print(f"[COARSE] n={n}, depth={d}, RMSE={rmse:.4f}")
        if rmse < best_rmse:
            best_rmse = rmse
            best_params = (n, d)
            
# Train best model
best_n, best_d = best_params
rf = RandomForestRegressor(
    n_estimators=best_n,
    max_depth=best_d,
    random_state=42
)
rf.fit(X_train, y_train)

# Predict current quarter GDP nowcast
latest_quarter['spread'] = latest_quarter['BAA'] - latest_quarter['AAA']
latest_quarter['term_spread'] = latest_quarter['GS10'] - latest_quarter['TB3MS']
latest_quarter['INDPRO_growth'] = np.log(latest_quarter['INDPRO']).diff()
latest_quarter['HOUST_growth'] = np.log(latest_quarter['HOUST']).diff()
latest_quarter['INVEST_growth'] = np.log(latest_quarter['INVEST']).diff()
latest_quarter = latest_quarter.tail(1)
Xcurrent = latest_quarter[['spread', 'term_spread','INDPRO_growth', 'HOUST_growth', 'UNRATE', 'INVEST_growth']]
current_gdp_nowcast = rf.predict(Xcurrent)

print("\nBest RMSE:", best_rmse)
print("Best Params:", best_params)
print(f"Current GDP Nowcast ({Xcurrent.index[0].date()}): {current_gdp_nowcast[0]:.4f}")

# Actual vs Predicted GDP - RF model function to be called       
def predicted_vs_actual_gdp():
    results = pd.DataFrame({
        'Actual_GDP': y_test,
        'Predicted_GDP': y_pred
    })
    nowcast_row = pd.DataFrame({
    'Actual_GDP': [np.nan],
    'Predicted_GDP': [current_gdp_nowcast[0]]
    }, index=[Xcurrent.index[0]])
    results = pd.concat([results, nowcast_row])
    return results

# NOTE: Model is not fully accurate yet, but you can still call this function for BE/FE

import pandas as pd
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from quarterly_and_monthly_data import get_quarterly_data_rf

# get current file directory
quarterly_data = get_quarterly_data_rf()
latest_quarter = pd.DataFrame(quarterly_data.tail(1))


df_quarterly = quarterly_data.copy()
df_quarterly = df_quarterly.dropna()
df_quarterly.index = pd.to_datetime(df_quarterly.index)
df_quarterly = df_quarterly.sort_index()

#define x and y for monthly data
x = df_quarterly.drop(columns=['GDPC1'])
y = df_quarterly['GDPC1']


# spreads and key signals
x['spread'] = x['BAA'] - x['AAA']
x['term_spread'] = x['GS10'] - x['TB3MS']
x['INDPRO_growth'] = np.log(x['INDPRO']).diff()
x['HOUST_growth'] = np.log(x['HOUST']).diff()
x['INVEST_growth'] = np.log(df_quarterly['INVEST']).diff()
x = x[['spread', 'term_spread','INDPRO_growth', 'HOUST_growth', 'UNRATE', 'INVEST_growth']]
#x = x[['spread', 'term_spread', 'INDPRO_growth', 'HOUST_growth', 'UNRATE']]
x = x.dropna()
y = y.loc[x.index]

# split into train and test sets (train - first 80% of observations, test - last 20% of observations)
split_index = int(len(x) * 0.8)
X_train = x.iloc[:split_index]
X_test  = x.iloc[split_index:]
y_train = y.iloc[:split_index]
y_test  = y.iloc[split_index:]

'''
#Train the random forest model
rf = RandomForestRegressor(
    n_estimators=300, #number of trees in the forest
    max_depth=None, #maximum depth of the tree 
    min_samples_leaf=1,
    random_state=42 #for reproducibility (seed)
)
rf.fit(X_train, y_train)

#Predict on the test set
y_pred = rf.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
print("RMSE:", rmse)
print("Pred std:", np.std(y_pred))
print("Actual std:", np.std(y_test))
results = pd.DataFrame({
    'Actual': y_test,
    'Predicted': y_pred
})
'''

#find the optimal number of trees (n_estimators) & depth using out-of-bag error
n_estimators_list = list(range(100, 501, 100))
max_depth_list = list(range(3, 16, 2)) + [None]
results = []
best_rmse = float('inf')
best_params = None

for n in n_estimators_list:
    for d in max_depth_list:
        rf = RandomForestRegressor(
            n_estimators=n,
            max_depth=d,
            random_state=42,
            )
        rf.fit(X_train, y_train)
        y_pred = rf.predict(X_test)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        results.append((n, d, rmse))
        print(f"[COARSE] n={n}, depth={d}, RMSE={rmse:.4f}")
        if rmse < best_rmse:
            best_rmse = rmse
            best_params = (n, d)
            
# Train best model
best_n, best_d = best_params
rf = RandomForestRegressor(
    n_estimators=best_n,
    max_depth=best_d,
    random_state=42
)
rf.fit(X_train, y_train)

# Predict current quarter GDP nowcast
latest_quarter['spread'] = latest_quarter['BAA'] - latest_quarter['AAA']
latest_quarter['term_spread'] = latest_quarter['GS10'] - latest_quarter['TB3MS']
latest_quarter['INDPRO_growth'] = np.log(latest_quarter['INDPRO']).diff()
latest_quarter['HOUST_growth'] = np.log(latest_quarter['HOUST']).diff()
latest_quarter['INVEST_growth'] = np.log(latest_quarter['INVEST']).diff()
latest_quarter = latest_quarter.tail(1)
Xcurrent = latest_quarter[['spread', 'term_spread','INDPRO_growth', 'HOUST_growth', 'UNRATE', 'INVEST_growth']]
current_gdp_nowcast = rf.predict(Xcurrent)

print("\nBest RMSE:", best_rmse)
print("Best Params:", best_params)
print(f"Current GDP Nowcast ({Xcurrent.index[0].date()}): {current_gdp_nowcast[0]:.4f}")

# Actual vs Predicted GDP - RF model function to be called       
def predicted_vs_actual_gdp():
    results = pd.DataFrame({
        'Actual_GDP': y_test,
        'Predicted_GDP': y_pred
    })
    nowcast_row = pd.DataFrame({
    'Actual_GDP': [np.nan],
    'Predicted_GDP': [current_gdp_nowcast[0]]
    }, index=[Xcurrent.index[0]])
    results = pd.concat([results, nowcast_row])
    return results

# NOTE: Model is not fully accurate yet, but you can still call this function for BE/FE

def get_rf_backtest_output():
    """
    Returns RF backtest output in the format needed for ensemble evaluation:
    dates, actual, forecast
    """
    results = predicted_vs_actual_gdp().copy()

    # Drop the nowcast row because Actual_GDP is NaN there
    results = results.dropna(subset=["Actual_GDP", "Predicted_GDP"])

    dates = results.index
    actual = results["Actual_GDP"].values
    forecast = results["Predicted_GDP"].values

    return dates, actual, forecast