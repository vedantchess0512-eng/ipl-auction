#!/usr/bin/env python3
import re

def find_matching_brace(s, start):
    """Find matching } for { at given position (accounts for strings)."""
    count = 1
    in_string = False
    string_char = None
    i = start
    while i < len(s):
        c = s[i]
        if in_string:
            if c == string_char and s[i-1] != '\\':
                in_string = False
            i += 1
            continue
        if c in ('"', "'"):
            in_string = True
            string_char = c
        elif c == '{':
            count += 1
        elif c == '}':
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def find_matching_paren(s, start):
    """Find matching ) for ( at given position."""
    count = 1
    in_string = False
    string_char = None
    i = start + 1
    while i < len(s):
        c = s[i]
        if in_string:
            if c == string_char and s[i-1] != '\\':
                in_string = False
            i += 1
            continue
        if c in ('"', "'"):
            in_string = True
            string_char = c
        elif c == '(':
            count += 1
        elif c == ')':
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def extract_full_component(content, const_name):
    """
    Extract full component like:
    const X = React.memo(({ props... }) => ( <jsx...> ))
    """
    # Find the start of the component definition
    pattern = r'^\s*const ' + const_name + r' = React\.memo\(\s*\(\s*\{'
    match = re.search(pattern, content, re.MULTILINE)
    if not match:
        return None, -1, -1

    start = match.start()

    # Find the opening ( for React.memo(
    memo_open = content.find('React.memo(', start)
    if memo_open == -1:
        return None, -1, -1

    # Find the ( that opens React.memo's argument
    first_paren = content.find('(', memo_open + len('React.memo(') - 1)
    if first_paren == -1:
        return None, -1, -1

    # Find matching ) for React.memo(
    end_memo = find_matching_paren(content, first_paren)
    if end_memo == -1:
        return None, -1, -1

    # The component definition spans from 'start' to 'end_memo' (inclusive)
    component_text = content[start:end_memo + 1]

    return component_text, start, end_memo + 1

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Find export default line
    export_pattern = r'^(export default function \w+\(\)\s*\{)'
    export_match = re.search(export_pattern, content, re.MULTILINE)
    if not export_match:
        print("  ERROR: Could not find export default function")
        return False

    export_start = export_match.start()

    # Extract LeftPanel
    left_text, left_start, left_end = extract_full_component(content, 'LeftPanel')
    if not left_text:
        print("  ERROR: Could not extract LeftPanel")
        return False
    print(f"  Found LeftPanel: {left_start}-{left_end}")

    # Extract RightPanel (if exists)
    right_text, right_start, right_end = extract_full_component(content, 'RightPanel')
    if right_text:
        print(f"  Found RightPanel: {right_start}-{right_end}")
    else:
        print("  No RightPanel found")
        right_text = ""

    # Remove both from content (remove from highest index first to preserve positions)
    removals = []
    if left_text:
        removals.append((left_start, left_end))
    if right_text:
        removals.append((right_start, right_end))

    removals.sort(reverse=True)

    new_content = content
    for start, end in removals:
        new_content = new_content[:start] + new_content[end:]

    # Now insert panels before export default
    export_match2 = re.search(export_pattern, new_content, re.MULTILINE)
    if not export_match2:
        print("  ERROR: export line not found after removal")
        return False

    insert_pos = export_match2.start()

    panels_block = ""
    if left_text:
        panels_block += left_text + "\n"
    if right_text:
        panels_block += right_text + "\n"

    final_content = new_content[:insert_pos] + panels_block + "\n" + new_content[insert_pos:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  SUCCESS: Panels moved outside in {filepath}")
    return True

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
