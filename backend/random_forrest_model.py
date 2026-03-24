import pandas as pd
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from quarterly_and_monthly_data import get_monthly_data, get_quarterly_data

# get current file directory
monthly_data = get_monthly_data()
quarterly_data = get_quarterly_data()

df_monthly = monthly_data.copy()
df_monthly = df_monthly.dropna()

#define x and y for monthly data
x = df_monthly.drop(columns=['GDPC1'])
y = df_monthly['GDPC1']