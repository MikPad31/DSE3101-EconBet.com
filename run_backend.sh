#!/bin/bash

# Navigate to the backend directory
cd backend

# Ensure necessary directories exist
mkdir -p data
mkdir -p models/__pycache__

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Run the ensemble and evaluation script
echo "Running ensemble and evaluation..."
python run_ensemble.py

echo "Backend process completed."
