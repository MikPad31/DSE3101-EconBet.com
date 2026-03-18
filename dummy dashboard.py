# INSTALLATION REQUIRED: 
# Run the following command in your terminal to install dependencies:
# pip install dash dash-bootstrap-components pandas plotly numpy

import dash
from dash import dcc, html, dash_table, Input, Output
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import pandas as pd
import numpy as np

# ==========================================
# STEP 1: GENERATE SYNTHETIC DATA
# ==========================================
np.random.seed(42)
dates = pd.date_range(start='2024-01-01', end='2026-12-01', freq='MS')
n_periods = len(dates)

# Generate underlying trend (sine wave with a slight downward drift)
trend = np.sin(np.linspace(0, 3*np.pi, n_periods)) * 1.5 + np.linspace(3, 1.5, n_periods)

# Initialize DataFrame
df = pd.DataFrame({'Date': dates})

# Define Status logic based on "current time" context (e.g. early 2026)
statuses = []
for d in dates:
    if d < pd.to_datetime('2026-01-01'):
        statuses.append('Official')
    elif d < pd.to_datetime('2026-03-01'):
        statuses.append('Backcast')
    elif d < pd.to_datetime('2026-06-01'):
        statuses.append('Flash Estimate')
    else:
        statuses.append('Forecast')
df['Status'] = statuses

# Generate Series Data
df['Official_GDP'] = np.where(df['Status'] == 'Official', trend + np.random.normal(0, 0.1, n_periods), np.nan)
df['AR_Benchmark'] = trend + np.random.normal(0, 0.2, n_periods) - 0.2
df['Random_Forest_Bridge'] = trend + np.random.normal(0, 0.15, n_periods) + 0.1
df['Combined_Nowcast'] = (df['AR_Benchmark'] + df['Random_Forest_Bridge']) / 2

# Expanding Uncertainty Bounds (smaller in past, larger in future)
uncertainty = np.linspace(0.1, 0.9, n_periods)
df['Lower_Bound'] = df['Combined_Nowcast'] - uncertainty
df['Upper_Bound'] = df['Combined_Nowcast'] + uncertainty

# Ragged Edge Monitor Data
ragged_data = pd.DataFrame({
    'Indicator': ['Housing Starts', 'BAA-AAA Spread', 'Ind. Production', 'Retail Sales', 'Nonfarm Payrolls'],
    'Frequency': ['Monthly', 'Daily', 'Monthly', 'Monthly', 'Monthly'],
    'Latest Data Month': ['Feb 2026', 'Mar 2026', 'Jan 2026', 'Feb 2026', 'Feb 2026'],
    'Status': ['Released', 'Released', 'Revised', 'Pending', 'Released']
})

# ==========================================
# STEP 2 & 3: DASHBOARD LAYOUT SETUP
# ==========================================
# Initialize Dash app with CYBORG dark theme
app = dash.Dash(__name__, external_stylesheets=[dbc.themes.CYBORG])

# Custom CSS variables/styles - EconBet Brand Colors (Navy & Green)
BRAND_NAVY_DARK = "#060b14" # Main background
BRAND_NAVY_CARD = "#10192e" # Card background
BRAND_NAVY_BORDER = "#1f3052" # Borders
BRAND_GREEN = "#5cb85c" # Logo green accent

CARD_STYLE = {
    "backgroundColor": BRAND_NAVY_CARD, 
    "border": f"1px solid {BRAND_NAVY_BORDER}", 
    "borderRadius": "8px", 
    "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
}

sidebar = html.Div([
    # --- LOGO INSERTION HERE ---
    # Dash will automatically look in the 'assets' folder for this image.
    html.Img(
        src='/assets/logo.png', 
        style={
            'maxWidth': '100%', 
            'marginBottom': '20px', 
            'backgroundColor': 'white', # White bg helps the dark navy letters pop if it's not a transparent PNG
            'padding': '10px', 
            'borderRadius': '6px'
        }
    ),
    
    html.H5("Macro Nowcasting Terminal", className="fw-bold mb-4", style={"color": "white", "fontWeight": "bold"}),
    html.Hr(style={"borderColor": BRAND_NAVY_BORDER}),
    
    html.Label("Select Forecasting Models:", className="fw-bold mb-2", style={"color": "white"}),
    dcc.Checklist(
        id='model-checklist',
        options=[
            {'label': ' AR Benchmark', 'value': 'AR_Benchmark'},
            {'label': ' Random Forest Bridge', 'value': 'Random_Forest_Bridge'},
            {'label': ' Combined Nowcast', 'value': 'Combined_Nowcast'}
        ],
        value=['Combined_Nowcast'],
        inputStyle={"marginRight": "8px"},
        labelStyle={"display": "block", "marginBottom": "10px", "color": "white"}
    ),
    
    html.Br(),
    html.Label("Historical Time-Travel Vintage:", className="fw-bold mb-2", style={"color": "white"}),
    dcc.Dropdown(
        id='vintage-dropdown',
        options=[
            {'label': 'March 2026 (Live)', 'value': 'Mar26'},
            {'label': 'February 2026', 'value': 'Feb26'},
            {'label': 'January 2026', 'value': 'Jan26'}
        ],
        value='Mar26',
        clearable=False,
        style={"backgroundColor": BRAND_NAVY_CARD, "color": "#000"} # text color fix for dropdowns in dark mode
    )
], style={'backgroundColor': '#0b1221', 'padding': '25px', 'minHeight': '100vh', 'borderRight': f'1px solid {BRAND_NAVY_BORDER}'})

kpi_ribbon = dbc.Row([
    dbc.Col(dbc.Card(dbc.CardBody([
        html.H6("Current Q1 Nowcast (Combined)", style={"color": "white"}),
        html.H3("2.4%", className="fw-bold m-0", style={"color": BRAND_GREEN}) # Brand Green
    ]), style=CARD_STYLE)),
    dbc.Col(dbc.Card(dbc.CardBody([
        html.H6("4-Quarter Forecast (Q1 2027)", style={"color": "white"}),
        html.H3("1.8%", className="text-warning fw-bold m-0")
    ]), style=CARD_STYLE)),
    dbc.Col(dbc.Card(dbc.CardBody([
        html.H6("95% Confidence Interval", style={"color": "white"}),
        html.H3("± 0.6%", className="text-info fw-bold m-0")
    ]), style=CARD_STYLE))
], className="mb-4")

ragged_edge_table = dash_table.DataTable(
    id='ragged-edge-table',
    columns=[{"name": i, "id": i} for i in ragged_data.columns],
    data=ragged_data.to_dict('records'),
    style_header={
        'backgroundColor': BRAND_NAVY_BORDER, 'color': 'white',
        'fontWeight': 'bold', 'border': f'1px solid {BRAND_NAVY_BORDER}'
    },
    style_data={
        'backgroundColor': BRAND_NAVY_CARD, 'color': 'white',
        'border': f'1px solid {BRAND_NAVY_BORDER}'
    },
    style_cell={
        'fontFamily': 'Inter, sans-serif',
        'textAlign': 'left', 'padding': '12px'
    },
    style_data_conditional=[
        {'if': {'filter_query': '{Status} = "Pending"', 'column_id': 'Status'}, 'color': '#f39c12', 'fontWeight': 'bold'},
        {'if': {'filter_query': '{Status} = "Released"', 'column_id': 'Status'}, 'color': BRAND_GREEN, 'fontWeight': 'bold'},
        {'if': {'filter_query': '{Status} = "Revised"', 'column_id': 'Status'}, 'color': '#3498db', 'fontWeight': 'bold'}
    ]
)

app.layout = dbc.Container([
    dbc.Row([
        # Left Sidebar (approx 20% width)
        dbc.Col(sidebar, md=3, lg=2, className="px-0"),
        
        # Right Main Content (approx 80% width)
        dbc.Col([
            kpi_ribbon,
            # Hero Chart
            dbc.Card(dbc.CardBody([
                html.H5("Real-Time GDP Growth Path", className="mb-3 fw-bold", style={"color": "white"}),
                dcc.Graph(id='hero-chart', style={'height': '55vh'})
            ]), style=CARD_STYLE, className="mb-4"),
            
            # Ragged Edge Monitor
            dbc.Card(dbc.CardBody([
                html.H5("Ragged Edge Data Monitor", className="mb-3 fw-bold", style={"color": "white"}),
                ragged_edge_table
            ]), style=CARD_STYLE)
            
        ], md=9, lg=10, style={'padding': '30px', 'backgroundColor': BRAND_NAVY_DARK})
    ])
], fluid=True, style={"padding": "0"})


# ==========================================
# STEP 4: INTERACTIVITY & PLOTLY CHART LOGIC
# ==========================================
@app.callback(
    Output('hero-chart', 'figure'),
    Input('model-checklist', 'value')
)
def update_chart(selected_models):
    fig = go.Figure()
    
    # Utility function to plot continuous segments without gaps
    def add_segment(status_filter, name, color, dash_style, mode='lines', marker=None, line_width=3):
        mask = df['Status'] == status_filter
        if not mask.any(): return
        
        # Get indices and include the point right before the segment starts to connect the lines seamlessly
        indices = np.where(mask)[0]
        if len(indices) > 0 and indices[0] > 0:
            plot_idx = np.insert(indices, 0, indices[0]-1)
        else:
            plot_idx = indices
            
        sub_df = df.iloc[plot_idx]
        fig.add_trace(go.Scatter(
            x=sub_df['Date'], y=sub_df['Combined_Nowcast'],
            mode=mode, name=name, marker=marker,
            line=dict(color=color, width=line_width, dash=dash_style)
        ))

    # 1. Uncertainty Bands (Plotted first so they sit in the background)
    if 'Combined_Nowcast' in selected_models:
        fig.add_trace(go.Scatter(
            x=df['Date'], y=df['Lower_Bound'], 
            mode='lines', line=dict(width=0), 
            showlegend=False, hoverinfo='skip'
        ))
        fig.add_trace(go.Scatter(
            x=df['Date'], y=df['Upper_Bound'], 
            mode='lines', line=dict(width=0), 
            fill='tonexty', fillcolor='rgba(92, 184, 92, 0.08)', # Tinted green background
            name='95% Model Consensus Interval'
        ))

    # 2. Always plot Official GDP (Thick solid line - Light Blue for contrast)
    official_mask = df['Status'] == 'Official'
    fig.add_trace(go.Scatter(
        x=df.loc[official_mask, 'Date'], 
        y=df.loc[official_mask, 'Official_GDP'],
        mode='lines', name='Official GDP (BEA)',
        line=dict(color='#5dade2', width=5) 
    ))

    # 3. Dynamic Model Traces based on Checklist
    if 'Combined_Nowcast' in selected_models:
        # Segmented styling for Combined Nowcast based on certainty
        add_segment('Official', 'Nowcast (Historical Fit)', '#666666', 'solid', line_width=2)
        add_segment('Backcast', 'Backcast', '#f39c12', 'dot')
        add_segment('Flash Estimate', 'Flash Estimate', BRAND_GREEN, 'dash', mode='lines+markers', marker=dict(size=9, symbol='circle')) # Brand Green
        add_segment('Forecast', '4-Quarter Forecast', '#9b59b6', 'dash')

    # Add other benchmark lines if selected
    if 'AR_Benchmark' in selected_models:
        fig.add_trace(go.Scatter(
            x=df['Date'], y=df['AR_Benchmark'], mode='lines', 
            name='AR Benchmark', line=dict(color='#e74c3c', dash='dashdot', width=2)
        ))
        
    if 'Random_Forest_Bridge' in selected_models:
        fig.add_trace(go.Scatter(
            x=df['Date'], y=df['Random_Forest_Bridge'], mode='lines', 
            name='Random Forest Bridge', line=dict(color='#f1c40f', dash='dashdot', width=2)
        ))

    # 4. Chart Aesthetics & Theming
    fig.update_layout(
        plot_bgcolor=BRAND_NAVY_CARD,
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter, sans-serif', color='#e0e0e0'),
        margin=dict(l=20, r=20, t=20, b=20),
        xaxis=dict(
            showgrid=True, gridcolor=BRAND_NAVY_BORDER, gridwidth=1, 
            zeroline=False, title=''
        ),
        yaxis=dict(
            showgrid=True, gridcolor=BRAND_NAVY_BORDER, gridwidth=1, 
            zeroline=True, zerolinecolor='#555', title='GDP Growth Rate (%)'
        ),
        legend=dict(
            orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1,
            bgcolor='rgba(0,0,0,0)'
        ),
        hovermode='x unified'
    )
    
    return fig

# Run App
if __name__ == '__main__':
    # Make sure to run `pip install dash dash-bootstrap-components pandas plotly numpy` before running
    app.run(debug=True)