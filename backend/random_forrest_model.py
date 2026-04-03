import pandas as pd
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
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

#Getting Best Parameters Using Time Series Split
tscv = TimeSeriesSplit(n_splits=5)

n_estimators_list = [100, 200, 300] 
max_depth_list = [3, 5, 7, None]   
results = []

best_rmse = float('inf')
best_params = None
for n in n_estimators_list:
    for d in max_depth_list:
        fold_rmses = []
        #splits X and y into 5 successive chunks
        for train_index, val_index in tscv.split(X):
            X_t, X_v = X.iloc[train_index], X.iloc[val_index]
            y_t, y_v = y.iloc[train_index], y.iloc[val_index]
            rf = RandomForestRegressor(
                n_estimators=n,
                max_depth=d,
                random_state=42,
                n_jobs=-1 # Uses all CPU cores to speed this up
            )
            rf.fit(X_t, y_t)
            y_pred = rf.predict(X_v)
            rmse = np.sqrt(mean_squared_error(y_v, y_pred))
            fold_rmses.append(rmse)
        
        #Calculate Average Performance across all 5 windows
        avg_rmse = np.mean(fold_rmses)
        results.append((n, d, avg_rmse))
        if avg_rmse < best_rmse:
            best_rmse = avg_rmse
            best_params = (n, d)

print(f"Best Parameters found via CV: Trees={best_params[0]}, Depth={best_params[1]}")
print(f"Average CV RMSE: {best_rmse:.4f}")
best_n, best_d = best_params

# Historical Predictions (CV Approach - RF trained)
cv_errors = []
cv_preds = []
cv_actuals = []
cv_dates = []

def get_predicted_vs_actual_df(X, y, best_n, best_d, test_size_pct=0.5):
    """
    Simulates a live environment by walking through history and 
    generating one-quarter-ahead nowcasts.
    """
    cv_preds = []
    cv_actuals = []
    cv_dates = []
    start_idx = len(X) - int(len(X) * test_size_pct)
    for i in range(start_idx, len(X)):
        X_train_cv = X.iloc[:i]
        y_train_cv = y.iloc[:i]
        X_test_cv = X.iloc[i:i+1]
        y_test_cv = y.iloc[i:i+1]
        
        rf_cv = RandomForestRegressor(
            n_estimators=best_n,
            max_depth=best_d,
            random_state=42,
            n_jobs=-1
        )
        rf_cv.fit(X_train_cv, y_train_cv)
        y_pred_cv = rf_cv.predict(X_test_cv)

        cv_preds.append(y_pred_cv[0])
        cv_actuals.append(y_test_cv.values[0])
        cv_dates.append(X_test_cv.index[0])
    results_df = pd.DataFrame({
        "Actual_GDP": cv_actuals,
        "Predicted_GDP": cv_preds
    }, index=cv_dates)
    total_rmse = np.sqrt(mean_squared_error(results_df["Actual_GDP"], results_df["Predicted_GDP"]))
    return results_df, total_rmse

# --- EXECUTION ---
# This assumes you've already run your tuning loop to get best_n and best_d
history_df, final_rmse = get_predicted_vs_actual_df(X, y, best_n, best_d)
print(f"Backtest RMSE (Last {len(history_df)} quarters): {final_rmse:.4f}")

#Nowcasting current quarter GDP  
rf_final = RandomForestRegressor(
    n_estimators=best_n, 
    max_depth=best_d, 
    random_state=42,
    n_jobs=-1
)
rf_final.fit(X, y)
Xcurrent = x_full.tail(1)
current_gdp_nowcast = rf_final.predict(Xcurrent)[0]

#Historical Predictions Vs Actuals DataFrame
nowcast_row = pd.DataFrame({
    "Actual_GDP": [np.nan],
    "Predicted_GDP": [float(current_gdp_nowcast)]
}, index=pd.DatetimeIndex([Xcurrent.index[0]]))
history_df = history_df[["Actual_GDP", "Predicted_GDP"]].astype(float)
cv_results = pd.concat([history_df, nowcast_row])
def predicted_vs_actual_gdp():
    return cv_results 

#print(predicted_vs_actual_gdp().head(30))

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
