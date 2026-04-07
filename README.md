# DSE3101-EconBet.com
## FRED API Key Setup

This project uses the FRED API to retrieve macroeconomic data. To run or deploy the app, you will need to provide your own FRED API key.

### 1. Create a `.env` file
In the root directory of the project, create a file named `.env`.

### 2. Add your FRED API key
Insert the following line into the `.env` file:

```bash
FRED_API_KEY=your_fred_api_key_here
```

### 3. Install required package
Make sure python-dotenv is installed so the app can load environment variables correctly:

```bash
pip install python-dotenv
```

