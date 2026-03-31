# INSTALLATION REQUIRED: 
# pip install dash dash-bootstrap-components pandas plotly numpy

import dash
from dash import dcc, html, dash_table, Input, Output
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import pandas as pd
import numpy as np
import os

# ==========================================
# STEP 1: LOAD REAL BACKEND DATA
# ==========================================
# Looks for the CSV in the backend/data folder, or falls back to local directory
df = pd.read_csv('backend/data/ensemble_forecasts.csv') 

df['Date'] = pd.to_datetime(df['date'])

# Mapping CSV columns to the Dashboard logic
df = df.rename(columns={
    'actual': 'Official_GDP',
    'forecast_AR': 'AR_Benchmark',
    'forecast_ADL': 'Model_3_ADL',
    'forecast_RF': 'Random_Forest_Bridge',
    'forecast_Ensemble': 'Combined_Nowcast',
    'CI_Lower': 'Lower_Bound',
    'CI_Upper': 'Upper_Bound'
})

# Dynamic Status Logic (Color-coded certainty spectrum based on latest data)
max_date = df['Date'].max()
statuses = []
for d in df['Date']:
    if d >= max_date - pd.DateOffset(months=3): # Very latest is Forecast
        statuses.append('Forecast')
    elif d >= max_date - pd.DateOffset(months=9): # Previous are flash/backcasts
        statuses.append('Flash Estimate')
    else:
        statuses.append('Official')
df['Status'] = statuses

# Hide actuals for future/unreleased dates
df['Official_GDP'] = np.where(df['Status'] == 'Official', df['Official_GDP'], np.nan)

min_year = df['Date'].dt.year.min()
max_year = df['Date'].dt.year.max()

# Dummy ragged edge data (can be replaced with real FRED status later)
ragged_data = pd.DataFrame({
    'Indicator': ['Housing Starts', 'BAA-AAA Spread', 'Ind. Production', 'Retail Sales', 'Nonfarm Payrolls'],
    'Frequency': ['Monthly', 'Daily', 'Monthly', 'Monthly', 'Monthly'],
    'Latest Data Month': ['Feb 2026', 'Mar 2026', 'Jan 2026', 'Feb 2026', 'Feb 2026'],
    'Status': ['Released', 'Released', 'Revised', 'Pending', 'Released']
})

# ==========================================
# STEP 2: THEME DICTIONARY & BRANDING
# ==========================================
BRAND_GREEN = "#5cb85c"

THEMES = {
    True: { # DARK MODE
        "bg": "#060b14", "sidebar_bg": "#0b1221", "card": "#10192e",
        "border": "#1f3052", "text": "#ffffff", "grid": "#1f3052",
        "logo_src": "assets/logo_dark.png" 
    },
    False: { # LIGHT MODE
        "bg": "#f4f6f9", "sidebar_bg": "#ffffff", "card": "#ffffff",
        "border": "#dee2e6", "text": "#212529", "grid": "#e9ecef",
        "logo_src": "assets/logo_light.png" 
    }
}

app = dash.Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])

# ==========================================
# STEP 3: DASHBOARD LAYOUT
# ==========================================
sidebar = html.Div(id='sidebar-container', children=[
    html.Img(id='logo-img', style={'maxWidth': '100%', 'marginBottom': '20px'}),
    html.H5(id='page-title-text', children="Macro Nowcasting Terminal", className="fw-bold mb-4"),
    html.Hr(id='sidebar-hr'),
    
    html.Label(id='select-models-label', children="Select Forecasting Models:", className="fw-bold mb-3"),
    dbc.Checklist(
        id='model-checklist',
        options=[
            {'label': ' AR Benchmark', 'value': 'AR_Benchmark'},
            {'label': ' ADL Model', 'value': 'Model_3_ADL'},
            {'label': ' Random Forest Bridge', 'value': 'Random_Forest_Bridge'},
            {'label': ' Combined Nowcast', 'value': 'Combined_Nowcast'},
            {'label': ' 📊 Show Confidence Interval', 'value': 'Show_CI'}
        ],
        value=['Combined_Nowcast', 'Show_CI'],
        switch=True, 
        className="mb-4"
    ),
    
    html.Label(id='historical-vintage-label', children="Historical Time-Travel Vintage:", className="fw-bold mb-2"),
    dcc.Dropdown(
        id='vintage-dropdown',
        options=[{'label': 'March 2026 (Live)', 'value': 'Mar26'},
                 {'label': 'February 2026', 'value': 'Feb26'}],
        value='Mar26', clearable=False, style={"color": "#000", "marginBottom": "20px"} 
    ),
    
    # REACT/TAILWIND STYLE TOGGLE
    html.Div(
        id='theme-toggle-container',
        n_clicks=0,
        children=[
            html.Div(id='theme-toggle-sun', children="☀"),
            html.Div(id='theme-toggle-moon', children="☾")
        ]
    )
    
], style={
    'padding': '25px', 'height': '100vh', 'position': 'sticky', 'top': '0',                  
    'overflowY': 'auto', 'transition': 'all 0.3s ease', 'display': 'flex', 'flexDirection': 'column'
})

kpi_ribbon = dbc.Row([
    dbc.Col(dbc.Card(id='kpi-card-1', children=dbc.CardBody([
        html.H6(id='kpi-header-1', children="Current Nowcast (Combined)"),
        html.H3(id='kpi-value-1', children="...", className="fw-bold m-0", style={"color": BRAND_GREEN}),
        html.Div(id='kpi-subtext-1', children="...", style={"fontSize": "13px", "marginTop": "4px"})
    ]))),
    dbc.Col(dbc.Card(id='kpi-card-2', children=dbc.CardBody([
        html.H6(id='kpi-header-2', children="Next Quarter Forecast (T+1)"),
        html.H3(id='kpi-value-2', children="...", className="text-warning fw-bold m-0"),
        html.Div(id='kpi-subtext-2', children="Forward Guidance", style={"fontSize": "13px", "marginTop": "4px", "color": "#888"})
    ]))),
    dbc.Col(dbc.Card(id='kpi-card-3', children=dbc.CardBody([
        html.H6(id='kpi-header-3', children="95% Confidence Range"),
        html.H3(id='kpi-value-3', children="...", className="text-info fw-bold m-0"),
        html.Div(id='kpi-subtext-3', children="Downside risk evaluated", style={"fontSize": "13px", "marginTop": "4px", "color": "#888"})
    ])))
], className="mb-4")

app.layout = html.Div(id='main-page-wrapper', children=[
    dbc.Container([
        dbc.Row([
            dbc.Col(sidebar, md=3, lg=2, className="px-0"),
            dbc.Col(id='main-content', children=[
                kpi_ribbon,
                
                dbc.Card(id='chart-card', children=dbc.CardBody([
                    html.H5(id='chart-card-title', children="Real-Time GDP Growth Path", className="mb-3 fw-bold"),
                    dcc.Graph(id='hero-chart', style={'height': '50vh'}),
                    html.Div([
                        dcc.RangeSlider(
                            id='year-slider',
                            min=min_year, max=max_year, step=1,
                            value=[min_year, max_year],
                            className="mt-4"
                        )
                    ], style={'padding': '0px 20px 20px 20px'})
                ]), className="mb-4"),
                
                dbc.Card(id='table-card', children=dbc.CardBody([
                    html.H5(id='table-card-title', children="Ragged Edge Data Monitor", className="mb-3 fw-bold"),
                    dash_table.DataTable(id='ragged-edge-table', data=ragged_data.to_dict('records'))
                ]))
            ], md=9, lg=10, style={'padding': '30px', 'transition': 'all 0.3s ease'})
        ])
    ], fluid=True, style={"padding": "0", "overflowX": "hidden"})
])

# ==========================================
# STEP 4: MASTER THEME & CHART CALLBACK
# ==========================================
@app.callback(
    [Output('sidebar-container', 'style'), Output('main-content', 'style'), Output('main-page-wrapper', 'style'),
     Output('kpi-card-1', 'style'), Output('kpi-card-2', 'style'), Output('kpi-card-3', 'style'),
     Output('chart-card', 'style'), Output('table-card', 'style'),
     Output('logo-img', 'src'),
     Output('theme-toggle-container', 'style'), Output('theme-toggle-sun', 'style'), Output('theme-toggle-moon', 'style'),
     Output('page-title-text', 'style'), Output('select-models-label', 'style'), Output('historical-vintage-label', 'style'),
     Output('kpi-header-1', 'style'), Output('kpi-header-2', 'style'), Output('kpi-header-3', 'style'),
     Output('chart-card-title', 'style'), Output('table-card-title', 'style'),
     Output('model-checklist', 'labelStyle'),
     Output('ragged-edge-table', 'style_header'), Output('ragged-edge-table', 'style_data'),
     Output('ragged-edge-table', 'style_cell'), Output('ragged-edge-table', 'style_data_conditional'),
     Output('year-slider', 'marks'),
     Output('hero-chart', 'figure'),
     # NEW: KPI Values Outputs
     Output('kpi-value-1', 'children'), Output('kpi-subtext-1', 'children'), Output('kpi-subtext-1', 'style'),
     Output('kpi-value-2', 'children'),
     Output('kpi-value-3', 'children')],
    [Input('theme-toggle-container', 'n_clicks'), 
     Input('model-checklist', 'value'),
     Input('year-slider', 'value')] 
)
def update_dashboard(n_clicks, selected_models, year_range):
    is_dark = (n_clicks % 2 == 0) # 0 clicks = Dark Mode default
    t = THEMES[is_dark]
    
    # Backgrounds and containers
    wrapper_style = {'backgroundColor': t['bg'], 'minHeight': '100vh'}
    sidebar_style = {'backgroundColor': t['sidebar_bg'], 'borderRight': f'1px solid {t["border"]}', 'color': t['text'], 'padding': '25px', 'height': '100vh', 'position': 'sticky', 'top': '0', 'overflowY': 'auto', 'display': 'flex', 'flexDirection': 'column'}
    main_style = {'backgroundColor': t['bg'], 'padding': '30px', 'minHeight': '100vh', 'color': t['text']}
    card_style = {'backgroundColor': t['card'], 'border': f'1px solid {t["border"]}', 'borderRadius': '8px', 'color': t['text'], 'boxShadow': '0 4px 6px rgba(0,0,0,0.1)'}
    
    text_color_force = {'color': t['text']}
    checklist_label_style = {"display": "block", "marginBottom": "8px", "color": t['text'], "fontWeight": "normal"}
    slider_marks = {str(y): {'label': str(y), 'style': {'color': t['text']}} for y in range(min_year, max_year+1)}

    toggle_container_style = {
        'display': 'flex', 'alignItems': 'center', 'justifyContent': 'space-between',
        'width': '100%', 'padding': '4px', 'borderRadius': '9999px', 'marginTop': 'auto',
        'cursor': 'pointer', 'transition': 'all 0.3s ease',
        'backgroundColor': '#1a2642' if is_dark else '#f3f4f6',
        'border': f'1px solid {"#2d3f6d" if is_dark else "#e5e7eb"}',
    }

    sun_style = {
        'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center',
        'width': '32px', 'height': '32px', 'borderRadius': '9999px', 'transition': 'all 0.3s ease', 'fontSize': '16px',
        'backgroundColor': 'transparent' if is_dark else '#ffffff',
        'color': '#6b7280' if is_dark else '#eab308',
        'boxShadow': 'none' if is_dark else '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    }

    moon_style = {
        'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center',
        'width': '32px', 'height': '32px', 'borderRadius': '9999px', 'transition': 'all 0.3s ease', 'fontSize': '16px',
        'backgroundColor': '#2d3f6d' if is_dark else 'transparent',
        'color': '#60a5fa' if is_dark else '#6b7280',
        'boxShadow': '0 1px 2px 0 rgba(0, 0, 0, 0.05)' if is_dark else 'none',
    }

    tbl_header = {'backgroundColor': t['sidebar_bg'], 'color': t['text'], 'fontWeight': 'bold', 'border': f'1px solid {t["border"]}'}
    tbl_data = {'backgroundColor': t['card'], 'color': t['text'], 'border': f'1px solid {t["border"]}'}
    tbl_cell = {'fontFamily': 'Inter, sans-serif', 'textAlign': 'left', 'padding': '12px'}
    tbl_cond = [
        {'if': {'filter_query': '{Status} = "Pending"', 'column_id': 'Status'}, 'color': '#f39c12', 'fontWeight': 'bold'},
        {'if': {'filter_query': '{Status} = "Released"', 'column_id': 'Status'}, 'color': BRAND_GREEN, 'fontWeight': 'bold'},
        {'if': {'filter_query': '{Status} = "Revised"', 'column_id': 'Status'}, 'color': '#3498db', 'fontWeight': 'bold'}
    ]

    # ==========================================
    # DATA-DRIVEN KPI LOGIC
    # ==========================================
    official_data = df[df['Status'] == 'Official']
    if not official_data.empty and len(official_data) < len(df):
        last_official_idx = official_data.index[-1]
        
        # 1. Current Nowcast (The quarter right after the last official release)
        current_q = df.iloc[last_official_idx + 1]
        prev_q = df.iloc[last_official_idx]
        
        delta = current_q['Combined_Nowcast'] - prev_q['Official_GDP']
        kpi_1_val = f"{current_q['Combined_Nowcast']:.2f}%"
        kpi_1_sub = f"▲ +{delta:.2f}% from prev quarter" if delta > 0 else f"▼ {delta:.2f}% from prev quarter"
        kpi_1_sub_color = "#5cb85c" if delta > 0 else "#e74c3c"
        
        # 2. Next Quarter Forecast (T+1)
        if last_official_idx + 2 < len(df):
            next_q = df.iloc[last_official_idx + 2]
            kpi_2_val = f"{next_q['Combined_Nowcast']:.2f}%"
        else:
            kpi_2_val = "N/A"
            
        # 3. Confidence Interval Range
        kpi_3_val = f"[{current_q['Lower_Bound']:.2f}%, {current_q['Upper_Bound']:.2f}%]"
    else:
        kpi_1_val, kpi_1_sub, kpi_1_sub_color, kpi_2_val, kpi_3_val = "N/A", "N/A", "#888", "N/A", "N/A"

    kpi_1_sub_style = {"fontSize": "13px", "marginTop": "4px", "fontWeight": "bold", "color": kpi_1_sub_color}

    # ==========================================
    # CHART GENERATION
    # ==========================================
    mask = (df['Date'].dt.year >= year_range[0]) & (df['Date'].dt.year <= year_range[1])
    sub_df = df.loc[mask]
    fig = go.Figure()

    def add_trace_custom(y_col, name, color, dash_style):
        if y_col in selected_models:
            fig.add_trace(go.Scatter(x=sub_df['Date'], y=sub_df[y_col], mode='lines+markers', name=name, marker=dict(size=6, line=dict(width=1, color=t['card'])), line=dict(color=color, dash=dash_style, width=2), hovertemplate=f"<b>{name}</b><br>Date: %{{x|%b %Y}}<br>Value: %{{y:.2f}}%<extra></extra>"))

    if 'Combined_Nowcast' in selected_models and 'Show_CI' in selected_models:
        fig.add_trace(go.Scatter(x=sub_df['Date'], y=sub_df['Lower_Bound'], mode='lines', line=dict(width=0), showlegend=False, hoverinfo='skip'))
        fig.add_trace(go.Scatter(x=sub_df['Date'], y=sub_df['Upper_Bound'], mode='lines', line=dict(width=0), fill='tonexty', fillcolor='rgba(92, 184, 92, 0.15)', name='95% Model Consensus Interval', hoverinfo='skip'))

    add_trace_custom('AR_Benchmark', 'AR Benchmark', '#e74c3c', 'dashdot')
    add_trace_custom('Model_3_ADL', 'ADL Model', '#3498db', 'dot')
    add_trace_custom('Random_Forest_Bridge', 'Random Forest Bridge', '#f1c40f', 'dashdot')

    if 'Combined_Nowcast' in selected_models:
        def add_segment(status_filter, name, color, dash_style, line_width=3):
            s_mask = sub_df['Status'] == status_filter
            if not s_mask.any(): return
            indices = np.where(s_mask)[0]
            plot_idx = np.insert(indices, 0, indices[0]-1) if (len(indices) > 0 and indices[0] > 0) else indices
            seg_df = sub_df.iloc[plot_idx]
            fig.add_trace(go.Scatter(x=seg_df['Date'], y=seg_df['Combined_Nowcast'], mode='lines+markers', name=name, marker=dict(size=8, symbol='circle', color=color, line=dict(width=1.5, color=t['card'])), line=dict(color=color, width=line_width, dash=dash_style), hovertemplate=f"<b>{name}</b><br>Date: %{{x|%b %Y}}<br>Value: %{{y:.2f}}%<extra></extra>"))
            
        add_segment('Official', 'Nowcast (Historical Fit)', '#888888' if is_dark else '#555555', 'solid', line_width=2)
        add_segment('Backcast', 'Backcast', '#f39c12', 'dot')
        add_segment('Flash Estimate', 'Flash Estimate', BRAND_GREEN, 'dash')
        add_segment('Forecast', '4-Quarter Forecast', '#9b59b6', 'dash')

    official_mask = sub_df['Status'] == 'Official'
    fig.add_trace(go.Scatter(x=sub_df.loc[official_mask, 'Date'], y=sub_df.loc[official_mask, 'Official_GDP'], mode='lines+markers', name='Official GDP (BEA)', marker=dict(size=6, color='#5dade2'), line=dict(color='#5dade2', width=4), hovertemplate="<b>Official BEA</b><br>Date: %{x|%b %Y}<br>Value: %{y:.2f}%<extra></extra>"))

    fig.update_layout(
        plot_bgcolor=t['card'], paper_bgcolor='rgba(0,0,0,0)', font=dict(family='Inter, sans-serif', color=t['text']),
        margin=dict(l=20, r=20, t=20, b=20), xaxis=dict(showgrid=True, gridcolor=t['grid'], gridwidth=1, zeroline=False),
        yaxis=dict(showgrid=True, gridcolor=t['grid'], gridwidth=1, zeroline=True, zerolinecolor=t['border'], title='GDP Growth Rate (%)'),
        legend=dict(orientation='h', yanchor='top', y=-0.15, xanchor='center', x=0.5, bgcolor='rgba(0,0,0,0)'),
        hovermode='x unified', hoverlabel=dict(bgcolor=t['sidebar_bg'], font_color=t['text'], bordercolor=t['border'])
    )
    
    # Returning 32 outputs exactly matching the @app.callback decorator list
    return (sidebar_style, main_style, wrapper_style, card_style, card_style, card_style, card_style, card_style, t['logo_src'], 
            toggle_container_style, sun_style, moon_style, 
            text_color_force, text_color_force, text_color_force, text_color_force, text_color_force, text_color_force, text_color_force, text_color_force,
            checklist_label_style, tbl_header, tbl_data, tbl_cell, tbl_cond, slider_marks, fig,
            kpi_1_val, kpi_1_sub, kpi_1_sub_style, kpi_2_val, kpi_3_val)

if __name__ == '__main__':
    app.run(debug=False)