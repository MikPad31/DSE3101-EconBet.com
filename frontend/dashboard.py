import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from scipy import stats

st.set_page_config(
    page_title="Macro Nowcasting Terminal",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ── Palette ────────────────────────────────────────────────────────────────────
STEEL      = "#4682B4"
GREEN      = "#5cb85c"
AMBER      = "#f39c12"
RED        = "#e74c3c"
PURPLE     = "#9b59b6"
BLUE_LINE  = "#5dade2"
DARK_BG    = "#060b14"
CARD_BG    = "#10192e"
SIDEBAR_BG = "#0b1221"
BORDER     = "#1f3052"

# ── CSS injection ──────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

* { font-family: 'Inter', -apple-system, sans-serif !important; }

/* Hide Streamlit chrome */
#MainMenu, footer, header { visibility: hidden; }

/* Metric cards */
[data-testid="metric-container"] {
    background-color: #10192e;
    border: 1px solid #1f3052;
    border-radius: 10px;
    padding: 18px 20px;
}

/* Tabs */
.stTabs [data-baseweb="tab-list"] {
    gap: 4px;
    border-bottom: 1px solid #1f3052;
    background: transparent;
}
.stTabs [data-baseweb="tab"] {
    background: transparent;
    border: none;
    color: #666;
    font-weight: 600;
    font-size: 14px;
    padding: 10px 20px;
    border-radius: 6px 6px 0 0;
}
.stTabs [aria-selected="true"] {
    background: #10192e !important;
    color: #4682B4 !important;
    border-bottom: 2px solid #4682B4 !important;
}

/* Sidebar */
[data-testid="stSidebar"] {
    background-color: #0b1221;
    border-right: 1px solid #1f3052;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1f3052; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #2d4a7a; }

/* Narrative pull-quote */
.narrative-block {
    background-color: #10192e;
    border-left: 3px solid #4682B4;
    border-radius: 0 8px 8px 0;
    padding: 16px 22px;
    margin-bottom: 20px;
    line-height: 1.7;
    font-size: 15px;
    color: #c8d6e8;
}

/* Status bar */
.status-bar {
    background-color: #0b1221;
    border: 1px solid #1f3052;
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 12px;
    color: #666;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 22px;
    letter-spacing: 0.02em;
}

/* Section headers */
.section-header {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4682B4;
    margin-bottom: 4px;
}

/* Ragged edge table */
.ragged-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}
.ragged-table th {
    background-color: #0b1221;
    color: #888;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 10px 14px;
    border-bottom: 1px solid #1f3052;
    text-align: left;
}
.ragged-table td {
    padding: 10px 14px;
    border-bottom: 1px solid #1a2642;
    color: #c8d6e8;
}
.ragged-table tr:last-child td { border-bottom: none; }
.badge-released { color: #5cb85c; font-weight: 700; }
.badge-pending  { color: #f39c12; font-weight: 700; }
.badge-revised  { color: #3498db; font-weight: 700; }

hr { border-color: #1f3052 !important; }
</style>
""", unsafe_allow_html=True)


# ── Data loading ───────────────────────────────────────────────────────────────
@st.cache_data
def load_data():
    df = pd.read_csv("backend/data/ensemble_forecasts.csv")
    df["Date"] = pd.to_datetime(df["date"])
    df = df.sort_values("Date").reset_index(drop=True)

    max_date = df["Date"].max()
    def classify(d):
        if d >= max_date - pd.DateOffset(months=3):
            return "Forecast"
        elif d >= max_date - pd.DateOffset(months=9):
            return "Flash Estimate"
        return "Official"

    df["Status"] = df["Date"].apply(classify)
    df["actual"] = np.where(df["Status"] == "Official", df["actual"], np.nan)
    return df


@st.cache_data
def load_metrics():
    mdf = pd.read_csv("backend/data/model_metrics.csv")
    weights = 1 / mdf["RMSFE"]
    mdf["Weight"] = (weights / weights.sum() * 100).round(1)
    return mdf


df       = load_data()
mdf      = load_metrics()

# ── Derived metrics ────────────────────────────────────────────────────────────
official     = df[df["Status"] == "Official"]
non_official = df[df["Status"] != "Official"]

current_q = non_official.iloc[0] if not non_official.empty else df.iloc[-1]
prev_q    = official.iloc[-1]  if not official.empty  else None

std_est       = (current_q["CI_Upper"] - current_q["CI_Lower"]) / (2 * 1.96)
recession_prob = (
    stats.norm.cdf(0, loc=current_q["forecast_Ensemble"], scale=std_est) * 100
    if std_est > 0 else 0.0
)

momentum = (
    current_q["forecast_Ensemble"] - prev_q["forecast_Ensemble"]
    if prev_q is not None else 0.0
)


# ── Narrative generator ────────────────────────────────────────────────────────
def generate_narrative():
    val     = current_q["forecast_Ensemble"]
    period  = current_q["Date"].to_period("Q")
    delta   = momentum
    dirn    = "accelerated" if delta > 0.05 else "decelerated" if delta < -0.05 else "held steady"
    ci_w    = current_q["CI_Upper"] - current_q["CI_Lower"]
    uncert  = "narrow" if ci_w < 5 else "moderate" if ci_w < 10 else "wide"
    risk_l  = "limited" if recession_prob < 15 else "elevated" if recession_prob < 30 else "significant"
    trend   = "above-trend" if val > 2.0 else "below-trend" if val < 1.0 else "near-trend"
    outlook = "continued expansion" if val > 1.5 else "moderate growth" if val > 0 else "potential contraction"

    return (
        f"The combined nowcast for <b>{period}</b> stands at <b>{val:.2f}%</b>, having {dirn} "
        f"by {abs(delta):.2f}pp from the prior quarter. "
        f"Model consensus is {uncert} (95%&nbsp;CI:&nbsp;[{current_q['CI_Lower']:.1f}%,&nbsp;"
        f"{current_q['CI_Upper']:.1f}%]), signalling <b>{risk_l} downside risk</b> with a "
        f"{recession_prob:.1f}% implied probability of contraction. "
        f"The current trajectory is consistent with <b>{outlook}</b> and {trend} output dynamics."
    )


# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    try:
        st.image("frontend/assets/logo_dark.png", width="stretch")
    except Exception:
        st.markdown("### Macro Nowcasting Terminal")

    st.markdown("---")
    st.markdown("**Model Visibility**")
    show_ar       = st.checkbox("AR Benchmark",         value=False)
    show_adl      = st.checkbox("ADL Model",            value=False)
    show_rf       = st.checkbox("Random Forest Bridge", value=False)
    show_combined = st.checkbox("Combined Nowcast",     value=True)

    st.markdown("**Confidence Interval**")
    ci_level = st.radio(
        "Confidence Interval", ["95% + 68%", "95% only", "Off"],
        index=0, label_visibility="collapsed"
    )

    st.markdown("**Time Range**")
    time_range = st.radio(
        "Time Range", ["1Y", "5Y", "MAX"],
        index=2, horizontal=True, label_visibility="collapsed"
    )


# ── Time range filter ──────────────────────────────────────────────────────────
max_year = df["Date"].dt.year.max()
if time_range == "1Y":
    df_plot = df[df["Date"].dt.year >= max_year - 1].copy()
elif time_range == "5Y":
    df_plot = df[df["Date"].dt.year >= max_year - 5].copy()
else:
    df_plot = df.copy()


# ── Base chart layout ──────────────────────────────────────────────────────────
def base_layout(**overrides):
    layout = dict(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor=CARD_BG,
        font=dict(family="Inter, sans-serif", color="#ffffff"),
        margin=dict(l=20, r=20, t=30, b=20),
        xaxis=dict(showgrid=True, gridcolor=BORDER, gridwidth=1, zeroline=False),
        yaxis=dict(showgrid=True, gridcolor=BORDER, gridwidth=1,
                   zerolinecolor=BORDER, title="GDP Growth Rate (%)"),
        legend=dict(orientation="h", yanchor="top", y=-0.18,
                    xanchor="center", x=0.5, bgcolor="rgba(0,0,0,0)"),
        hovermode="x unified",
        hoverlabel=dict(bgcolor=SIDEBAR_BG, font_color="#ffffff", bordercolor=BORDER),
    )
    layout.update(overrides)
    return layout


# ═══════════════════════════════════════════════════════════════════════════════
# HEADER
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## Macro Nowcasting Terminal")

vintage_str = df["Date"].max().strftime("%B %d, %Y")
st.markdown(f"""
<div class="status-bar">
    <span>📡 Data vintage: {vintage_str}</span>
    <span>Models: AR · ADL · Random Forest · Ensemble</span>
    <span>Frequency: Quarterly</span>
</div>
""", unsafe_allow_html=True)

c1, c2, c3 = st.columns(3)
with c1:
    mom_str = f"+{momentum:.2f}pp" if momentum >= 0 else f"{momentum:.2f}pp"
    st.metric("Combined Nowcast",
              f"{current_q['forecast_Ensemble']:.2f}%",
              delta=f"{mom_str} vs prior quarter")
with c2:
    risk_label = "High risk" if recession_prob > 30 else "Moderate risk" if recession_prob > 15 else "Low risk"
    st.metric("Recession Risk (P(GDP<0))",
              f"{recession_prob:.1f}%",
              delta=risk_label,
              delta_color="inverse" if recession_prob > 15 else "normal")
with c3:
    ci_w = current_q["CI_Upper"] - current_q["CI_Lower"]
    st.metric("95% Confidence Range",
              f"[{current_q['CI_Lower']:.1f}%, {current_q['CI_Upper']:.1f}%]",
              delta=f"±{ci_w / 2:.1f}pp uncertainty",
              delta_color="off")

st.markdown("---")


# ═══════════════════════════════════════════════════════════════════════════════
# TABS
# ═══════════════════════════════════════════════════════════════════════════════
tab1, tab2, tab3 = st.tabs([
    "  📊  Overview  ",
    "  🔬  Model Performance  ",
    "  🔭  Forward Outlook  ",
])


# ─────────────────────────────────────────────────────────────────────────────
# TAB 1 — OVERVIEW
# ─────────────────────────────────────────────────────────────────────────────
with tab1:
    st.markdown(
        f'<div class="narrative-block">{generate_narrative()}</div>',
        unsafe_allow_html=True
    )

    # ── Hero fan chart ────────────────────────────────────────────────────────
    fig = go.Figure()

    # 95% CI band
    if ci_level != "Off":
        fig.add_trace(go.Scatter(
            x=df_plot["Date"], y=df_plot["CI_Lower"],
            mode="lines", line=dict(width=0),
            showlegend=False, hoverinfo="skip"
        ))
        fig.add_trace(go.Scatter(
            x=df_plot["Date"], y=df_plot["CI_Upper"],
            mode="lines", line=dict(width=0),
            fill="tonexty", fillcolor="rgba(70,130,180,0.13)",
            name="95% CI", hoverinfo="skip"
        ))

    # 68% CI band (derived from 95%)
    if ci_level == "95% + 68%":
        std_all  = (df_plot["CI_Upper"].values - df_plot["CI_Lower"].values) / (2 * 1.96)
        ci68_lo  = df_plot["forecast_Ensemble"].values - std_all
        ci68_hi  = df_plot["forecast_Ensemble"].values + std_all
        fig.add_trace(go.Scatter(
            x=df_plot["Date"], y=ci68_lo,
            mode="lines", line=dict(width=0),
            showlegend=False, hoverinfo="skip"
        ))
        fig.add_trace(go.Scatter(
            x=df_plot["Date"], y=ci68_hi,
            mode="lines", line=dict(width=0),
            fill="tonexty", fillcolor="rgba(70,130,180,0.22)",
            name="68% CI", hoverinfo="skip"
        ))

    # "Now" divider
    now_x = str(current_q["Date"].date())
    fig.add_shape(
        type="line", xref="x", yref="paper",
        x0=now_x, x1=now_x, y0=0, y1=1,
        line=dict(dash="dash", color="#444", width=1.5)
    )
    fig.add_annotation(
        x=now_x, y=1, yref="paper",
        text="Now", showarrow=False,
        font=dict(color="#666", size=11),
        xanchor="left", yanchor="top"
    )

    # Individual model overlays
    model_traces = [
        ("forecast_AR",  "AR Benchmark",         RED,    "dashdot", show_ar),
        ("forecast_ADL", "ADL Model",             STEEL,  "dot",     show_adl),
        ("forecast_RF",  "Random Forest Bridge",  AMBER,  "dashdot", show_rf),
    ]
    for col, name, color, dash, visible in model_traces:
        if visible:
            fig.add_trace(go.Scatter(
                x=df_plot["Date"], y=df_plot[col],
                mode="lines+markers", name=name,
                line=dict(color=color, dash=dash, width=1.5),
                marker=dict(size=4),
                hovertemplate=f"<b>{name}</b>: %{{y:.2f}}%<extra></extra>"
            ))

    # Official BEA GDP
    off_mask = df_plot["Status"] == "Official"
    fig.add_trace(go.Scatter(
        x=df_plot.loc[off_mask, "Date"],
        y=df_plot.loc[off_mask, "actual"],
        mode="lines+markers", name="Official GDP (BEA)",
        line=dict(color=BLUE_LINE, width=3),
        marker=dict(size=5),
        hovertemplate="<b>Official GDP</b>: %{y:.2f}%<extra></extra>"
    ))

    # Combined Nowcast — segmented by status
    if show_combined:
        seg_config = [
            ("Official",      "Nowcast (Hist. Fit)", "#555555", "solid",  2),
            ("Flash Estimate", "Flash Estimate",      GREEN,     "dash",   2.5),
            ("Forecast",      "4Q Forecast",          PURPLE,    "dash",   2.5),
        ]
        prev_status_last_idx = None
        for status, label, color, dash, lw in seg_config:
            s_mask = df_plot["Status"] == status
            if not s_mask.any():
                continue
            # Prepend last row of previous segment for visual continuity
            idxs = list(df_plot[s_mask].index)
            if prev_status_last_idx is not None and prev_status_last_idx in df_plot.index:
                idxs = [prev_status_last_idx] + idxs
            seg = df_plot.loc[idxs]
            prev_status_last_idx = df_plot[s_mask].index[-1]

            sym = "diamond" if status == "Forecast" else "circle"
            fig.add_trace(go.Scatter(
                x=seg["Date"], y=seg["forecast_Ensemble"],
                mode="lines+markers", name=label,
                line=dict(color=color, width=lw, dash=dash),
                marker=dict(size=7 if status != "Official" else 0, symbol=sym,
                            color=color, line=dict(width=1.5, color=DARK_BG)),
                hovertemplate=f"<b>{label}</b>: %{{y:.2f}}%<extra></extra>"
            ))

    fig.update_layout(**base_layout(height=460))
    st.plotly_chart(fig, width="stretch")

    # ── Ragged edge data monitor ──────────────────────────────────────────────
    st.markdown('<p class="section-header">Data Monitor</p>', unsafe_allow_html=True)

    ragged_data = [
        ("Housing Starts",   "Monthly", "Feb 2026", "Released"),
        ("BAA–AAA Spread",   "Daily",   "Mar 2026", "Released"),
        ("Ind. Production",  "Monthly", "Jan 2026", "Revised"),
        ("Retail Sales",     "Monthly", "Feb 2026", "Pending"),
        ("Nonfarm Payrolls", "Monthly", "Feb 2026", "Released"),
    ]
    badge = {
        "Released": '<span class="badge-released">● Released</span>',
        "Pending":  '<span class="badge-pending">● Pending</span>',
        "Revised":  '<span class="badge-revised">● Revised</span>',
    }
    rows = "".join(
        f"<tr><td>{ind}</td><td>{freq}</td><td>{latest}</td><td>{badge[status]}</td></tr>"
        for ind, freq, latest, status in ragged_data
    )
    st.markdown(f"""
    <table class="ragged-table">
        <thead><tr>
            <th>Indicator</th><th>Frequency</th><th>Latest Available</th><th>Status</th>
        </tr></thead>
        <tbody>{rows}</tbody>
    </table>
    """, unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# TAB 2 — MODEL PERFORMANCE
# ─────────────────────────────────────────────────────────────────────────────
with tab2:
    col_bar, col_donut = st.columns([3, 2])

    with col_bar:
        st.markdown('<p class="section-header">Forecast Error (RMSFE)</p>', unsafe_allow_html=True)
        st.caption("Lower RMSFE = better fit. Bar labels show inverse-RMSFE ensemble weight.")

        sorted_m = mdf.sort_values("RMSFE", ascending=True).reset_index(drop=True)
        bar_colors = [GREEN if i == 0 else STEEL for i in range(len(sorted_m))]

        fig_bar = go.Figure(go.Bar(
            x=sorted_m["RMSFE"],
            y=sorted_m["Model"],
            orientation="h",
            marker_color=bar_colors,
            text=[f"  {r:.3f}   weight: {w:.1f}%"
                  for r, w in zip(sorted_m["RMSFE"], sorted_m["Weight"])],
            textposition="outside",
            textfont=dict(color="#888", size=12),
            hovertemplate="<b>%{y}</b><br>RMSFE: %{x:.3f}<extra></extra>"
        ))
        fig_bar.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor=CARD_BG,
            font=dict(family="Inter, sans-serif", color="#ffffff"),
            margin=dict(l=20, r=140, t=10, b=20),
            xaxis=dict(showgrid=True, gridcolor=BORDER,
                       title="Root Mean Squared Forecast Error"),
            yaxis=dict(showgrid=False),
            height=240,
        )
        st.plotly_chart(fig_bar, width="stretch")

    with col_donut:
        st.markdown('<p class="section-header">Ensemble Weights</p>', unsafe_allow_html=True)
        st.caption("Allocation derived from inverse-RMSFE normalisation.")

        model_colors = [RED, STEEL, AMBER]
        fig_donut = go.Figure(go.Pie(
            labels=mdf["Model"],
            values=mdf["Weight"],
            hole=0.65,
            marker=dict(colors=model_colors, line=dict(color=DARK_BG, width=2)),
            textinfo="label+percent",
            textfont=dict(size=12),
            hovertemplate="<b>%{label}</b><br>Weight: %{value:.1f}%<extra></extra>"
        ))
        fig_donut.add_annotation(
            text="Ensemble<br>Weights", x=0.5, y=0.5,
            font=dict(size=13, color="#ffffff"), showarrow=False
        )
        fig_donut.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Inter, sans-serif", color="#ffffff"),
            margin=dict(l=10, r=10, t=10, b=10),
            showlegend=False,
            height=240,
        )
        st.plotly_chart(fig_donut, width="stretch")

    # Directional accuracy
    st.markdown('<p class="section-header">Directional Accuracy</p>', unsafe_allow_html=True)
    st.caption("Hit rate on predicting GDP direction of change. Baseline: 50% (coin flip).")

    dir_cols = st.columns(len(mdf))
    for i, (_, row) in enumerate(mdf.iterrows()):
        acc   = row["Directional_Accuracy"] * 100
        delta = acc - 50.0
        with dir_cols[i]:
            st.metric(
                label=row["Model"],
                value=f"{acc:.1f}%",
                delta=f"{'+' if delta >= 0 else ''}{delta:.1f}pp vs baseline"
            )

    # Rolling absolute error chart
    st.markdown('<p class="section-header">Forecast Error Over Time</p>', unsafe_allow_html=True)
    st.caption("Absolute error (|forecast − actual|) per model across official quarters.")

    off_df = df[df["Status"] == "Official"].copy()
    err_traces = [
        ("forecast_AR",       "AR Benchmark",        RED,    "dashdot"),
        ("forecast_ADL",      "ADL Model",           STEEL,  "dot"),
        ("forecast_RF",       "Random Forest Bridge",AMBER,  "dashdot"),
        ("forecast_Ensemble", "Combined Nowcast",    GREEN,  "solid"),
    ]
    fig_err = go.Figure()
    for col, name, color, dash in err_traces:
        err = (off_df[col] - off_df["actual"]).abs()
        fig_err.add_trace(go.Scatter(
            x=off_df["Date"], y=err,
            mode="lines", name=name,
            line=dict(color=color, dash=dash, width=2),
            hovertemplate=f"<b>{name}</b>: %{{y:.2f}}pp<extra></extra>"
        ))
    fig_err.update_layout(**base_layout(
        yaxis=dict(showgrid=True, gridcolor=BORDER,
                   title="Absolute Forecast Error (pp)"),
        height=300
    ))
    st.plotly_chart(fig_err, width="stretch")


# ─────────────────────────────────────────────────────────────────────────────
# TAB 3 — FORWARD OUTLOOK
# ─────────────────────────────────────────────────────────────────────────────
with tab3:
    col_gauge, col_right = st.columns([1, 2])

    with col_gauge:
        st.markdown('<p class="section-header">Recession Risk Gauge</p>', unsafe_allow_html=True)
        st.caption("P(GDP < 0) derived from 95% CI assuming a normal forecast distribution.")

        gauge_color = RED if recession_prob > 30 else AMBER if recession_prob > 15 else GREEN
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=recession_prob,
            number={"suffix": "%", "font": {"size": 42, "color": gauge_color}},
            delta={
                "reference": 15,
                "relative": False,
                "suffix": "pp vs 15% threshold",
                "increasing": {"color": RED},
                "decreasing": {"color": GREEN},
            },
            gauge={
                "axis": {
                    "range": [0, 100],
                    "ticksuffix": "%",
                    "tickcolor": "#555",
                    "tickwidth": 1,
                    "tickfont": {"color": "#888"},
                },
                "bar": {"color": gauge_color, "thickness": 0.25},
                "bgcolor": CARD_BG,
                "borderwidth": 0,
                "steps": [
                    {"range": [0,  15],  "color": "rgba(92,184,92,0.18)"},
                    {"range": [15, 30],  "color": "rgba(243,156,18,0.18)"},
                    {"range": [30, 100], "color": "rgba(231,76,60,0.18)"},
                ],
                "threshold": {
                    "line": {"color": "#ffffff", "width": 2},
                    "thickness": 0.75,
                    "value": recession_prob,
                },
            }
        ))
        fig_gauge.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Inter, sans-serif", color="#ffffff"),
            margin=dict(l=20, r=20, t=20, b=10),
            height=300,
        )
        st.plotly_chart(fig_gauge, width="stretch")

    with col_right:
        st.markdown('<p class="section-header">Forward Trajectory</p>', unsafe_allow_html=True)
        st.caption("Combined nowcast estimates for current and upcoming quarters.")

        fwd = non_official.head(3).reset_index(drop=True)
        horizon_labels = ["T+0 · Current", "T+1 · Next Quarter", "T+2 · Outlook"]

        if not fwd.empty:
            fwd_cols = st.columns(len(fwd))
            for i, (_, row) in enumerate(fwd.iterrows()):
                period = row["Date"].to_period("Q")
                label  = horizon_labels[i] if i < len(horizon_labels) else f"T+{i}"
                ci_str = f"[{row['CI_Lower']:.1f}%, {row['CI_Upper']:.1f}%]"
                with fwd_cols[i]:
                    st.metric(
                        label=f"{label}  ·  {period}",
                        value=f"{row['forecast_Ensemble']:.2f}%",
                        delta=f"95% CI: {ci_str}",
                        delta_color="off"
                    )

        # CI degradation sparkline
        st.markdown("")
        st.markdown('<p class="section-header">Uncertainty Horizon</p>', unsafe_allow_html=True)
        st.caption("Confidence interval width grows with distance from the current quarter.")

        fwd_all = non_official.head(6).reset_index(drop=True)
        ci_widths = fwd_all["CI_Upper"] - fwd_all["CI_Lower"]
        periods   = [str(d.to_period("Q")) for d in fwd_all["Date"]]

        fig_spark = go.Figure()
        fig_spark.add_trace(go.Scatter(
            x=periods, y=ci_widths,
            mode="lines+markers",
            line=dict(color=STEEL, width=2.5),
            marker=dict(size=8, color=STEEL, line=dict(color=DARK_BG, width=2)),
            fill="tozeroy",
            fillcolor="rgba(70,130,180,0.15)",
            hovertemplate="<b>%{x}</b><br>CI Width: %{y:.2f}pp<extra></extra>"
        ))
        fig_spark.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor=CARD_BG,
            font=dict(family="Inter, sans-serif", color="#ffffff"),
            margin=dict(l=20, r=20, t=10, b=20),
            xaxis=dict(showgrid=False, title="Quarter"),
            yaxis=dict(showgrid=True, gridcolor=BORDER,
                       title="95% CI Width (pp)"),
            height=220,
        )
        st.plotly_chart(fig_spark, width="stretch")
