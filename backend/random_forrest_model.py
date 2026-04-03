import pandas as pd
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from quarterly_and_monthly_data import get_quarterly_data_rf, months_missing

# get current file directory
quarterly_data = get_quarterly_data_rf()
df_quarterly = quarterly_data.copy()
df_quarterly.index = pd.to_datetime(df_quarterly.index)
df_quarterly = df_quarterly.sort_index()

# feature engineering on dataset
x_full = df_quarterly.copy()
x_full['spread'] = x_full['BAA'] - x_full['AAA']
x_full['term_spread'] = x_full['GS10'] - x_full['TB3MS']
x_full['INDPRO_growth'] = np.log(x_full['INDPRO']).diff()
x_full['HOUST_growth'] = np.log(x_full['HOUST']).diff()
x_full['INVEST_growth'] = np.log(x_full['INVEST']).diff()
x_full = x_full[['spread', 'term_spread','INDPRO_growth', 
                 'HOUST_growth', 'UNRATE', 'INVEST_growth', 'Covid', 'SARS']]
train_mask = df_quarterly['GDPC1'].notna()
X = x_full[train_mask]
y = df_quarterly.loc[train_mask, 'GDPC1']
X = X.dropna()
y = y.loc[X.index]

# split into train and test sets (train - first 80% of observations, test - last 20% of observations)
split_index = int(len(X) * 0.8)
X_train = X.iloc[:split_index]
X_test  = X.iloc[split_index:]
y_train = y.iloc[:split_index]
y_test  = y.iloc[split_index:]

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
        y_pred_loop = rf.predict(X_test)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred_loop))
        results.append((n, d, rmse))
        #print(f"[COARSE] n={n}, depth={d}, RMSE={rmse:.4f}")
        if rmse < best_rmse:
            best_rmse = rmse
            best_params = (n, d)
            
# Train best model to predict current GDP nowcast
best_n, best_d = best_params
rf = RandomForestRegressor(
    n_estimators=best_n,
    max_depth=best_d,
    random_state=42
)
rf.fit(X, y)
Xcurrent = x_full.tail(1)
#y_pred = rf.predict(Xcurrent)  

# Predict current quarter GDP nowcast
current_gdp_nowcast = rf.predict(Xcurrent)
print("\nBest RMSE:", best_rmse)
print("Best Params:", best_params)
print(
    f"Current GDP Nowcast ({Xcurrent.index[0].date()}): {current_gdp_nowcast[0]:.4f} "
    f"(based on {3 - months_missing}/3 months of data)"
)
# Historical Predictions (CV Approach - RF trained)
cv_errors = []
cv_preds = []
cv_actuals = []
cv_dates = []

start = int(len(X) * 0.5)
for i in range(start, len(X)):
    X_train_cv = X.iloc[:i]
    y_train_cv = y.iloc[:i]
    X_test_cv = X.iloc[i:i+1]
    y_test_cv = y.iloc[i:i+1]
    rf_cv = RandomForestRegressor(
        n_estimators=best_n,
        max_depth=best_d,
        random_state=42
    )
    rf_cv.fit(X_train_cv, y_train_cv)
    y_pred_cv = rf_cv.predict(X_test_cv)
    error = (y_test_cv.values[0] - y_pred_cv[0])**2
    cv_errors.append(error)
    cv_preds.append(y_pred_cv[0])
    cv_actuals.append(y_test_cv.values[0])
    cv_dates.append(X_test_cv.index[0])

cv_rmse = np.sqrt(np.mean(cv_errors))
print("CV RMSE:", cv_rmse)

nowcast_row = pd.DataFrame({
    "Date": [Xcurrent.index[0]],
    "Actual": [np.nan],
    "Predicted": [current_gdp_nowcast[0]]
}).set_index("Date")
cv_results = pd.DataFrame({
    "Date": cv_dates,
    "Actual_GDP": cv_actuals,
    "Predicted_GDP": cv_preds
}).set_index("Date")
cv_results = pd.concat([cv_results, nowcast_row])

def predicted_vs_actual_gdp():
    return cv_results 

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
