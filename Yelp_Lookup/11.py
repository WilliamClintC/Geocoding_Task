import streamlit as st
import pandas as pd

# Load CSV
df = pd.read_csv(r'C:\Users\clint\Desktop\Geocoding_Task\Yelp_Lookup\10.csv')

# Filter based on combined condition
enhanced_combined_condition = (
    (df['Scraped_phone_match_rate'] == True) |
    (df['Scraped_zipcode_to_label_match_rate'] == '6/6 successful match') |
    (df['Scraped_zipcode_to_label_match_rate'] == '7/6 successful match') |
    (df['Yelp_phone_match_rate'] == True)
)

filtered_df = df[~enhanced_combined_condition]

# Dropdown for distinct entries
option = st.selectbox(
    "Select match rate:",
    filtered_df['Scraped_zipcode_to_label_match_rate'].dropna().unique()
)

# Filter by selection
selected_df = filtered_df[
    filtered_df['Scraped_zipcode_to_label_match_rate'] == option
]

# Show columns 1 to 30
st.dataframe(
    selected_df.iloc[:, :30],
    use_container_width=True,
    hide_index=True
)

