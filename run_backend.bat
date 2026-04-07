@echo off
cd backend

echo Creating directories...
if not exist "data" mkdir data
if not exist "models\__pycache__" mkdir models\__pycache__

echo Installing Python dependencies...
pip install -r requirements.txt

echo Running ensemble and evaluation...
python run_ensemble.py

echo Backend process completed.
pause
