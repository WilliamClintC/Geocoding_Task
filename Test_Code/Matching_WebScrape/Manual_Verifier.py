import pandas as pd
import numpy as np
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import webbrowser
import os
import random
from functools import partial
import urllib.parse

class ManualVerifier:
    def __init__(self, root):
        self.root = root
        self.root.title("Manual Data Verification Tool")
        self.root.geometry("1200x750")
        self.root.resizable(True, True)
        
        # Variables
        self.df = None
        self.filtered_df = None
        self.current_index = 0
        self.verification_history = []
        self.current_category = None
        self.row_colors = {}  # Store row colors for highlighting
        
        # Load Data
        self.load_data()
        
        # Create main frame
        main_frame = ttk.Frame(root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Create notebook for tabs
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # Create verification tab
        verification_tab = ttk.Frame(self.notebook)
        self.notebook.add(verification_tab, text="Verification")
        
        # Create results tab
        results_tab = ttk.Frame(self.notebook)
        self.notebook.add(results_tab, text="Verified Results")
        
        # Create summary tab
        summary_tab = ttk.Frame(self.notebook)
        self.notebook.add(summary_tab, text="Summary")
        
        # Setup verification tab
        self.setup_verification_tab(verification_tab)
        
        # Setup results tab
        self.setup_results_tab(results_tab)
        
        # Setup summary tab
        self.setup_summary_tab(summary_tab)
        
        # Setup status bar
        self.setup_status_bar(main_frame)
        
        # Initialize verification view
        if self.df is not None and not self.df.empty:
            self.update_verification_view()
        
        # Auto-save setup
        self.records_since_save = 0
        self.auto_save_threshold = 3
    
    def load_data(self):
        """Load the dataset from CSV file"""
        try:
            # Check if Manual_Verified.csv exists
            verified_path = r'C:\Users\clint\Desktop\Geocoding_Task\Matching_WebScrape\Manual_Verified.csv'
            original_path = r'C:\Users\clint\Desktop\Geocoding_Task\Matching_WebScrape\8.csv'
            
            if os.path.exists(verified_path):
                self.df = pd.read_csv(verified_path)
                print("Loaded previously verified data")
            else:
                self.df = pd.read_csv(original_path)
                print("Loaded original data file")
            
            # Filter for states
            self.df = self.df[self.df['OCR_state'].isin(['CA', 'UT', 'NV', 'AZ'])]
            
            # Initialize verification columns if they don't exist
            if 'Manually_Verified' not in self.df.columns:
                self.df['Manually_Verified'] = 'no'
            if 'Manual_Verification_Result' not in self.df.columns:
                self.df['Manual_Verification_Result'] = ''
            if 'Manual_Verification_Reason' not in self.df.columns:
                self.df['Manual_Verification_Reason'] = ''
            
            # Initialize filtered dataframe
            self.filtered_df = self.df.copy()
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load data: {str(e)}")
            self.df = None
            self.filtered_df = None
    
    def setup_verification_tab(self, parent):
        """Set up the verification tab with all components"""
        # Top section - Category buttons & navigation tools
        top_frame = ttk.Frame(parent)
        top_frame.pack(fill=tk.X, pady=10)
        
        # Category buttons
        category_frame = ttk.LabelFrame(top_frame, text="Categories")
        category_frame.pack(side=tk.LEFT, padx=5)
        
        if self.df is not None:
            categories = self.df['Flag_Category'].unique()
            for category in categories:
                btn = ttk.Button(category_frame, text=category, 
                                 command=lambda c=category: self.select_category(c))
                btn.pack(side=tk.LEFT, padx=5, pady=5)
            
            # All categories button
            btn = ttk.Button(category_frame, text="All", command=self.reset_category)
            btn.pack(side=tk.LEFT, padx=5, pady=5)
        
        # Flag Reason Filter
        reason_filter_frame = ttk.LabelFrame(top_frame, text="Filter by Reason")
        reason_filter_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(reason_filter_frame, text="Flag Reason:").pack(side=tk.LEFT, padx=5)
        
        # Create StringVar for dropdown
        self.reason_filter_var = tk.StringVar(value="All")
        
        # Get unique values for Flag_Reason
        if self.df is not None and 'Flag_Reason' in self.df.columns:
            reasons = ['All'] + list(self.df['Flag_Reason'].dropna().unique())
            self.reason_dropdown = ttk.Combobox(reason_filter_frame, 
                                              textvariable=self.reason_filter_var,
                                              values=reasons,
                                              width=30)
            self.reason_dropdown.pack(side=tk.LEFT, padx=5, pady=5)
            
            # Bind selection event
            self.reason_dropdown.bind("<<ComboboxSelected>>", self.filter_by_reason)
        else:
            self.reason_dropdown = ttk.Combobox(reason_filter_frame, 
                                              textvariable=self.reason_filter_var,
                                              values=["All"],
                                              width=30)
            self.reason_dropdown.pack(side=tk.LEFT, padx=5, pady=5)
        
        # Navigation tools
        nav_frame = ttk.LabelFrame(top_frame, text="Navigation")
        nav_frame.pack(side=tk.LEFT, padx=20)
        
        ttk.Button(nav_frame, text="Previous", command=self.prev_record).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="Next", command=self.next_record).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="Random", command=self.random_record).pack(side=tk.LEFT, padx=5)
        
        # Jump to row
        jump_frame = ttk.Frame(nav_frame)
        jump_frame.pack(side=tk.LEFT, padx=20)
        
        ttk.Label(jump_frame, text="Go to Row:").pack(side=tk.LEFT)
        self.row_entry = ttk.Entry(jump_frame, width=8)
        self.row_entry.pack(side=tk.LEFT, padx=5)
        ttk.Button(jump_frame, text="Go", command=self.jump_to_row).pack(side=tk.LEFT)
        
        # External tools
        tools_frame = ttk.LabelFrame(parent, text="External Tools")
        tools_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(tools_frame, text="Open URL in Browser", command=self.open_url).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(tools_frame, text="Google Search", command=self.google_search).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(tools_frame, text="Undo Last Action", command=self.undo_action).pack(side=tk.RIGHT, padx=5, pady=5)
        ttk.Button(tools_frame, text="Save Now", command=self.save_data).pack(side=tk.RIGHT, padx=5, pady=5)
        
        # Main comparison area
        comparison_frame = ttk.LabelFrame(parent, text="Data Comparison")
        comparison_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        # Create two-column layout
        self.comparison_tree = ttk.Treeview(comparison_frame, columns=("OCR Column", "OCR Value", "Scraped Column", "Scraped Value"), show="headings", height=15)
        self.comparison_tree.heading("OCR Column", text="OCR Column")
        self.comparison_tree.heading("OCR Value", text="OCR Value")
        self.comparison_tree.heading("Scraped Column", text="Scraped Column")
        self.comparison_tree.heading("Scraped Value", text="Scraped Value")
        
        self.comparison_tree.column("OCR Column", width=150)
        self.comparison_tree.column("OCR Value", width=250)
        self.comparison_tree.column("Scraped Column", width=150)
        self.comparison_tree.column("Scraped Value", width=250)
        
        # Add scrollbar
        tree_scroll = ttk.Scrollbar(comparison_frame, orient="vertical", command=self.comparison_tree.yview)
        self.comparison_tree.configure(yscrollcommand=tree_scroll.set)
        
        # Pack elements
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.comparison_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Verification actions area
        verification_frame = ttk.LabelFrame(parent, text="Verification")
        verification_frame.pack(fill=tk.X, pady=10)
        
        # Verification buttons
        btn_frame = ttk.Frame(verification_frame)
        btn_frame.pack(fill=tk.X)
        
        ttk.Button(btn_frame, text="Yes - Match", command=lambda: self.verify_record("yes")).pack(side=tk.LEFT, padx=10, pady=5)
        ttk.Button(btn_frame, text="No - Not a Match", command=lambda: self.verify_record("no")).pack(side=tk.LEFT, padx=10, pady=5)
        ttk.Button(btn_frame, text="Maybe - Partial Match", command=lambda: self.verify_record("maybe")).pack(side=tk.LEFT, padx=10, pady=5)
        
        # Reason input
        reason_frame = ttk.Frame(verification_frame)
        reason_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(reason_frame, text="Verification Reason:").pack(side=tk.LEFT, padx=5)
        self.reason_entry = ttk.Entry(reason_frame, width=80)
        self.reason_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
    
    def setup_results_tab(self, parent):
        """Set up the verified results tab"""
        # Create frame for filters
        filter_frame = ttk.Frame(parent)
        filter_frame.pack(fill=tk.X, pady=10)
        
        ttk.Label(filter_frame, text="Filter by Verification:").pack(side=tk.LEFT, padx=5)
        self.filter_var = tk.StringVar(value="All")
        filter_combo = ttk.Combobox(filter_frame, textvariable=self.filter_var, 
                                   values=["All", "yes", "no", "maybe", "not verified"])
        filter_combo.pack(side=tk.LEFT, padx=5)
        ttk.Button(filter_frame, text="Apply Filter", command=self.update_results_view).pack(side=tk.LEFT, padx=5)
        
        # Create results treeview
        self.results_tree = ttk.Treeview(parent, columns=("ID", "OCR Name", "Scraped Name", "Verified", "Result", "Reason"), show="headings")
        
        # Define headings
        self.results_tree.heading("ID", text="ID")
        self.results_tree.heading("OCR Name", text="OCR Name")
        self.results_tree.heading("Scraped Name", text="Scraped Name")
        self.results_tree.heading("Verified", text="Verified")
        self.results_tree.heading("Result", text="Result")
        self.results_tree.heading("Reason", text="Reason")
        
        # Define columns
        self.results_tree.column("ID", width=40)
        self.results_tree.column("OCR Name", width=150)
        self.results_tree.column("Scraped Name", width=150)
        self.results_tree.column("Verified", width=60)
        self.results_tree.column("Result", width=80)
        self.results_tree.column("Reason", width=300)
        
        # Add scrollbar
        results_scroll = ttk.Scrollbar(parent, orient="vertical", command=self.results_tree.yview)
        self.results_tree.configure(yscrollcommand=results_scroll.set)
        
        # Pack elements
        results_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.results_tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # Bind double-click to jump to that record
        self.results_tree.bind("<Double-1>", self.on_result_double_click)
    
    def setup_summary_tab(self, parent):
        """Set up the summary tab"""
        # Create frame for summary statistics
        self.summary_frame = ttk.Frame(parent)
        self.summary_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Create refresh button
        refresh_btn = ttk.Button(self.summary_frame, text="Refresh Summary", command=self.update_summary)
        refresh_btn.pack(pady=10)
        
        # Create text widget for summary
        self.summary_text = scrolledtext.ScrolledText(self.summary_frame, wrap=tk.WORD, width=80, height=20)
        self.summary_text.pack(fill=tk.BOTH, expand=True)
        
        # Initial update
        self.update_summary()
    
    def setup_status_bar(self, parent):
        """Set up the status bar at the bottom of the window"""
        status_frame = ttk.Frame(parent, relief=tk.SUNKEN, padding=(5, 2))
        status_frame.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.status_label = ttk.Label(status_frame, text="Ready")
        self.status_label.pack(side=tk.LEFT)
        
        self.progress_label = ttk.Label(status_frame, text="")
        self.progress_label.pack(side=tk.RIGHT)
    
    def filter_by_reason(self, event=None):
        """Filter dataframe by the selected reason"""
        selected_reason = self.reason_filter_var.get()
        
        if selected_reason == "All":
            # If we have a category filter, respect that
            if self.current_category:
                self.filtered_df = self.df[self.df['Flag_Category'] == self.current_category].copy()
            else:
                self.filtered_df = self.df.copy()
        else:
            # Apply reason filter along with any existing category filter
            if self.current_category:
                self.filtered_df = self.df[(self.df['Flag_Category'] == self.current_category) & 
                                        (self.df['Flag_Reason'] == selected_reason)].copy()
            else:
                self.filtered_df = self.df[self.df['Flag_Reason'] == selected_reason].copy()
        
        self.current_index = 0
        self.update_verification_view()
        filter_text = f"Category: {self.current_category or 'All'}, Reason: {selected_reason}"
        self.update_status(f"{filter_text}, {len(self.filtered_df)} records")
    
    def select_category(self, category):
        """Filter dataframe by the selected category"""
        self.current_category = category
        
        # Apply category filter, but respect the reason filter if set
        selected_reason = self.reason_filter_var.get()
        if selected_reason == "All":
            self.filtered_df = self.df[self.df['Flag_Category'] == category].copy()
        else:
            self.filtered_df = self.df[(self.df['Flag_Category'] == category) & 
                                     (self.df['Flag_Reason'] == selected_reason)].copy()
        
        self.current_index = 0
        self.update_verification_view()
        filter_text = f"Category: {category}, Reason: {selected_reason}"
        self.update_status(f"{filter_text}, {len(self.filtered_df)} records")
    
    def reset_category(self):
        """Reset to show all categories"""
        self.current_category = None
        
        # Reset category filter but respect reason filter
        selected_reason = self.reason_filter_var.get()
        if selected_reason == "All":
            self.filtered_df = self.df.copy()
        else:
            self.filtered_df = self.df[self.df['Flag_Reason'] == selected_reason].copy()
        
        self.current_index = 0
        self.update_verification_view()
        filter_text = f"Category: All, Reason: {selected_reason}"
        self.update_status(f"{filter_text}, {len(self.filtered_df)} records")
    
    def update_verification_view(self):
        """Update the verification view with current record data"""
        if self.filtered_df is None or self.filtered_df.empty:
            messagebox.showinfo("Info", "No data to display")
            return
        
        # Clear existing data
        for item in self.comparison_tree.get_children():
            self.comparison_tree.delete(item)
        
        # Get current record
        if self.current_index >= len(self.filtered_df) or self.current_index < 0:
            self.current_index = 0
        
        record = self.filtered_df.iloc[self.current_index]
        
        # Add Flag_Reason at the top of the table
        if 'Flag_Reason' in record and pd.notnull(record['Flag_Reason']):
            self.comparison_tree.insert("", 0, values=("Flag_Reason", record['Flag_Reason'], "", ""), 
                                      tags=("flag_reason",))
            self.comparison_tree.insert("", 1, values=("", "", "", ""), tags=("separator",))
        
        # Mapping of columns to compare
        comparisons = [
            ('OCR_address', 'Scraped_Street Address'),
            ('OCR_label', 'Scraped_name'),
            ('OCR_city', 'Scraped_City'),
            ('OCR_major_city', 'Scraped_City'),
            ('OCR_zip_code', 'Scraped_Postal Code'),
            ('OCR_phone', 'Scraped_Phone'),
            ('OCR_phone', 'Scraped_Phone 2'),
            ('OCR_phone', 'Scraped_Phone 3'),
            ('OCR_phone', 'Scraped_Phone 4'),
            ('OCR_phone', 'Phone 5'),
            ('OCR_year', 'Scraped_Year'),
            ('OCR_state', 'Scraped_State'),
            ('OCR_chain', 'Scraped_Chain'),
            ('OCR_Main_Road', 'Scraped_Road Name'),
            ('OCR_Main_Road', 'Scraped_Highway'),
            ('OCR_Exit_Number', 'Scraped_Exit'),
            ('OCR_clean_line1', 'Scraped_Mailing Address'),
            ('OCR_clean_line2', 'Scraped_Mailing Address'),
            ('OCR_clean_line3', 'Scraped_Mailing Address')
        ]
        
        # Add data to treeview with color coding
        for i, (ocr_col, scraped_col) in enumerate(comparisons):
            ocr_value = str(record.get(ocr_col, "")).strip()
            scraped_value = str(record.get(scraped_col, "")).strip()
            
            # Determine match type
            if ocr_value == scraped_value and ocr_value:
                tag = "exact_match"
            elif (ocr_value in scraped_value or scraped_value in ocr_value) and ocr_value and scraped_value:
                tag = "partial_match"
            else:
                tag = "no_match"
            
            item_id = self.comparison_tree.insert("", "end", values=(ocr_col, ocr_value, scraped_col, scraped_value), tags=(tag,))
            
        # Configure tag colors
        self.comparison_tree.tag_configure("exact_match", background="#CCFFCC")  # Light green
        self.comparison_tree.tag_configure("partial_match", background="#FFFFCC")  # Light yellow
        self.comparison_tree.tag_configure("no_match", background="#FFCCCC")  # Light red
        self.comparison_tree.tag_configure("flag_reason", background="#E0E0FF")  # Light blue for flag reason
        self.comparison_tree.tag_configure("separator", background="#F0F0F0")  # Light gray for separator
        
        # Clear reason entry
        self.reason_entry.delete(0, tk.END)
        
        # Add reason if already verified
        if record['Manually_Verified'] == 'yes':
            self.reason_entry.insert(0, record['Manual_Verification_Reason'])
        
        # Update progress label
        self.progress_label.config(text=f"Record {self.current_index + 1} of {len(self.filtered_df)}")
    
    def next_record(self):
        """Move to the next record"""
        if self.filtered_df is None or self.filtered_df.empty:
            return
        
        self.current_index += 1
        if self.current_index >= len(self.filtered_df):
            self.current_index = 0
            messagebox.showinfo("Navigation", "Reached the end of records. Starting from beginning.")
        
        self.update_verification_view()
    
    def prev_record(self):
        """Move to the previous record"""
        if self.filtered_df is None or self.filtered_df.empty:
            return
        
        self.current_index -= 1
        if self.current_index < 0:
            self.current_index = len(self.filtered_df) - 1
            messagebox.showinfo("Navigation", "Reached the beginning of records. Starting from end.")
        
        self.update_verification_view()
    
    def random_record(self):
        """Go to a random record"""
        if self.filtered_df is None or self.filtered_df.empty:
            return
        
        self.current_index = random.randint(0, len(self.filtered_df) - 1)
        self.update_verification_view()
    
    def jump_to_row(self):
        """Jump to a specific row"""
        try:
            row = int(self.row_entry.get())
            if 0 <= row < len(self.filtered_df):
                self.current_index = row
                self.update_verification_view()
            else:
                messagebox.showerror("Error", f"Row number must be between 0 and {len(self.filtered_df)-1}")
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid row number")
    
    def verify_record(self, result):
        """Mark the current record as verified"""
        if self.filtered_df is None or self.filtered_df.empty or self.current_index >= len(self.filtered_df):
            return
        
        # Get the real index in the original dataframe
        real_idx = self.filtered_df.index[self.current_index]
        
        # Store current state for undo
        old_state = {
            'index': real_idx,
            'verified': self.df.at[real_idx, 'Manually_Verified'],
            'result': self.df.at[real_idx, 'Manual_Verification_Result'],
            'reason': self.df.at[real_idx, 'Manual_Verification_Reason']
        }
        self.verification_history.append(old_state)
        
        # Update dataframe
        self.df.at[real_idx, 'Manually_Verified'] = 'yes'
        self.df.at[real_idx, 'Manual_Verification_Result'] = result
        self.df.at[real_idx, 'Manual_Verification_Reason'] = self.reason_entry.get()
        
        # Update filtered_df as well
        self.filtered_df.at[real_idx, 'Manually_Verified'] = 'yes'
        self.filtered_df.at[real_idx, 'Manual_Verification_Result'] = result
        self.filtered_df.at[real_idx, 'Manual_Verification_Reason'] = self.reason_entry.get()
        
        # Move to next record
        self.records_since_save += 1
        self.next_record()
        
        # Auto-save if threshold reached
        if self.records_since_save >= self.auto_save_threshold:
            self.save_data()
            self.records_since_save = 0
    
    def undo_action(self):
        """Undo the last verification action"""
        if not self.verification_history:
            messagebox.showinfo("Undo", "Nothing to undo")
            return
        
        # Get the last action
        last_action = self.verification_history.pop()
        
        # Restore the values
        idx = last_action['index']
        self.df.at[idx, 'Manually_Verified'] = last_action['verified']
        self.df.at[idx, 'Manual_Verification_Result'] = last_action['result']
        self.df.at[idx, 'Manual_Verification_Reason'] = last_action['reason']
        
        # Update filtered_df as well
        if idx in self.filtered_df.index:
            self.filtered_df.at[idx, 'Manually_Verified'] = last_action['verified']
            self.filtered_df.at[idx, 'Manual_Verification_Result'] = last_action['result']
            self.filtered_df.at[idx, 'Manual_Verification_Reason'] = last_action['reason']
        
        # Find the index in filtered_df
        if idx in self.filtered_df.index:
            self.current_index = self.filtered_df.index.get_loc(idx)
            self.update_verification_view()
            messagebox.showinfo("Undo", "Last action undone")
        else:
            messagebox.showinfo("Undo", "Record was undone but is not in current filter view")
    
    def open_url(self):
        """Open the URL from the current record in a browser"""
        if self.filtered_df is None or self.filtered_df.empty or self.current_index >= len(self.filtered_df):
            return
        
        record = self.filtered_df.iloc[self.current_index]
        url = record.get('Scraped_full_url', '')
        
        if url and isinstance(url, str):
            webbrowser.open(url)
        else:
            messagebox.showinfo("URL", "No valid URL found for this record")
    
    def google_search(self):
        """Perform a Google search with the combined information"""
        if self.filtered_df is None or self.filtered_df.empty or self.current_index >= len(self.filtered_df):
            return
        
        record = self.filtered_df.iloc[self.current_index]
        
        # Combine information for search
        search_terms = []
        for field in ['Scraped_name', 'Scraped_Street Address', 'Scraped_City', 'Scraped_State', 'Scraped_Postal Code', 'Scraped_Phone']:
            if field in record and pd.notnull(record[field]) and record[field]:
                search_terms.append(str(record[field]))
        
        search_query = ' '.join(search_terms)
        
        if search_query:
            # Encode the search query for URL
            encoded_query = urllib.parse.quote(search_query)
            search_url = f"https://www.google.com/search?q={encoded_query}"
            webbrowser.open(search_url)
        else:
            messagebox.showinfo("Search", "No search terms found for this record")
    
    def save_data(self):
        """Save the dataframe to CSV"""
        try:
            output_path = r'C:\Users\clint\Desktop\Geocoding_Task\Matching_WebScrape\Manual_Verified.csv'
            self.df.to_csv(output_path, index=False)
            self.update_status(f"Data saved to {output_path}")
            self.records_since_save = 0
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save data: {str(e)}")
    
    def update_results_view(self):
        """Update the results tab view with filtered results"""
        # Clear existing data
        for item in self.results_tree.get_children():
            self.results_tree.delete(item)
        
        if self.df is None or self.df.empty:
            return
        
        # Apply filter
        filter_value = self.filter_var.get()
        if filter_value == "All":
            results_df = self.df
        elif filter_value == "not verified":
            results_df = self.df[self.df['Manually_Verified'] == 'no']
        else:
            results_df = self.df[(self.df['Manually_Verified'] == 'yes') & 
                               (self.df['Manual_Verification_Result'] == filter_value)]
        
        # Add data to treeview
        for i, (_, row) in enumerate(results_df.iterrows()):
            values = (
                i,
                row.get('OCR_label', ''),
                row.get('Scraped_name', ''),
                row.get('Manually_Verified', ''),
                row.get('Manual_Verification_Result', ''),
                row.get('Manual_Verification_Reason', '')
            )
            
            # Add with appropriate tag for coloring
            result = row.get('Manual_Verification_Result', '')
            if result == 'yes':
                tag = 'yes_result'
            elif result == 'no':
                tag = 'no_result'
            elif result == 'maybe':
                tag = 'maybe_result'
            else:
                tag = 'no_verification'
                
            self.results_tree.insert("", "end", values=values, tags=(tag,))
        
        # Configure tag colors
        self.results_tree.tag_configure('yes_result', background="#CCFFCC")  # Light green
        self.results_tree.tag_configure('no_result', background="#FFCCCC")  # Light red
        self.results_tree.tag_configure('maybe_result', background="#FFFFCC")  # Light yellow
    
    def on_result_double_click(self, event):
        """Handle double click on a result to jump to that record"""
        selection = self.results_tree.selection()
        if not selection:
            return
        
        # Get the selected item
        item = self.results_tree.item(selection[0])
        row_idx = item['values'][0]  # The ID column
        
        # Switch to verification tab
        self.notebook.select(0)
        
        # Find this record in the filtered DataFrame and set current_index
        if self.current_category:
            # Need to reset filter if we're looking at a specific category
            self.reset_category()
            
        # Set the index to the selected row
        self.current_index = row_idx
        self.update_verification_view()
    
    def update_summary(self):
        """Update the summary statistics"""
        if self.df is None or self.df.empty:
            self.summary_text.delete(1.0, tk.END)
            self.summary_text.insert(tk.END, "No data available for summary")
            return
        
        # Clear existing text
        self.summary_text.delete(1.0, tk.END)
        
        # Calculate summary statistics
        total_records = len(self.df)
        verified_records = sum(self.df['Manually_Verified'] == 'yes')
        
        # Calculate statistics by category
        categories = self.df['Flag_Category'].unique()
        category_stats = {}
        
        for category in categories:
            category_df = self.df[self.df['Flag_Category'] == category]
            total_in_category = len(category_df)
            verified_in_category = sum(category_df['Manually_Verified'] == 'yes')
            
            yes_in_category = sum((category_df['Manually_Verified'] == 'yes') & 
                                 (category_df['Manual_Verification_Result'] == 'yes'))
            no_in_category = sum((category_df['Manually_Verified'] == 'yes') & 
                                (category_df['Manual_Verification_Result'] == 'no'))
            maybe_in_category = sum((category_df['Manually_Verified'] == 'yes') & 
                                   (category_df['Manual_Verification_Result'] == 'maybe'))
            
            category_stats[category] = {
                'total': total_in_category,
                'verified': verified_in_category,
                'percent_verified': (verified_in_category / total_in_category * 100) if total_in_category > 0 else 0,
                'yes': yes_in_category,
                'no': no_in_category,
                'maybe': maybe_in_category
            }
        
        # Build summary text
        summary = f"=== VERIFICATION SUMMARY ===\n\n"
        summary += f"Total Records: {total_records}\n"
        summary += f"Total Verified: {verified_records} ({verified_records/total_records*100:.1f}%)\n\n"
        
        summary += "=== CATEGORY BREAKDOWN ===\n\n"
        
        for category, stats in category_stats.items():
            summary += f"Category: {category}\n"
            summary += f"  Total Records: {stats['total']}\n"
            summary += f"  Verified Records: {stats['verified']} ({stats['percent_verified']:.1f}%)\n"
            summary += f"  Matches (Yes): {stats['yes']}\n"
            summary += f"  Non-matches (No): {stats['no']}\n"
            summary += f"  Partial Matches (Maybe): {stats['maybe']}\n\n"
        
        # Calculate verification statistics by state
        states = ['CA', 'UT', 'NV', 'AZ']
        summary += "=== STATE BREAKDOWN ===\n\n"
        
        for state in states:
            state_df = self.df[self.df['OCR_state'] == state]
            state_total = len(state_df)
            state_verified = sum(state_df['Manually_Verified'] == 'yes')
            
            if state_total > 0:
                summary += f"State: {state}\n"
                summary += f"  Total Records: {state_total}\n"
                summary += f"  Verified Records: {state_verified} ({state_verified/state_total*100:.1f}%)\n\n"
        
        # Insert the summary
        self.summary_text.insert(tk.END, summary)
    
    def update_status(self, message):
        """Update the status bar with a message"""
        self.status_label.config(text=message)

# Create the main window and run the application
def main():
    root = tk.Tk()
    app = ManualVerifier(root)
    root.mainloop()

if __name__ == "__main__":
    main()
