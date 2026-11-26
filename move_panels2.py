#!/usr/bin/env python3
import re

def find_matching_paren(s, start):
    """Find the index of the matching closing ) for a ( at given start."""
    count = 0
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
        elif c == '(':
            count += 1
        elif c == ')':
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def extract_jsx_component(content, start_pattern):
    """Extract a full JSX component definition starting with start_pattern."""
    match = re.search(start_pattern, content, re.MULTILINE)
    if not match:
        return None, None, None

    start = match.start()

    # Find the React.memo(({ ... }) => ( ... )) pattern
    # Structure: React.memo(({ props }) => ( <jsx> ))

    # Find first '(' after React.memo
    memo_start = content.find('React.memo(', start)
    if memo_start == -1:
        return None, None, None

    # Find the opening ( for the memo call
    first_paren = content.find('(', memo_start + len('React.memo(') - 1)
    if first_paren == -1:
        return None, None, None

    # Find matching closing ) for React.memo(
    end_of_memo = find_matching_paren(content, first_paren + 1)
    if end_of_memo == -1:
        return None, None, None

    # Include the semicolon if present
    end = end_of_memo + 1
    if end < len(content) and content[end] == ';':
        end += 1

    # Also include trailing whitespace/newlines
    while end < len(content) and content[end] in ('\n', '\r', ' ', '\t'):
        end += 1

    component_text = content[start:end]
    return component_text, start, end

def move_panels_outside(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Find export default function line
    export_pattern = r'^(export default function \w+\(\)\s*\{)'
    export_match = re.search(export_pattern, content, re.MULTILINE)
    if not export_match:
        print("  ERROR: Could not find 'export default function'")
        return False

    export_start = export_match.start()
    export_line = export_match.group(0)

    # Extract LeftPanel
    left_pattern = r'^\s*// .*LEFT.*\n\s*const LeftPanel = React\.memo\('
    left_text, left_start, left_end = extract_jsx_component(content, left_pattern)

    if not left_text:
        print("  ERROR: Could not find LeftPanel")
        return False

    print(f"  Found LeftPanel at {left_start}-{left_end}")

    # Extract RightPanel
    right_pattern = r'^\s*// .*RIGHT.*\n\s*const RightPanel = React\.memo\('
    right_text, right_start, right_end = extract_jsx_component(content, right_pattern)

    right_text = right_text if right_text else ""
    if right_text:
        print(f"  Found RightPanel at {right_start}-{right_end}")
    else:
        print("  No RightPanel found (may be desktop file)")

    # Remove both from content
    # Sort by position (descending) so we don't mess up indices
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

    # Build the new content with panels inserted before export
    panels_block = ""
    if left_text:
        panels_block += left_text + "\n"
    if right_text:
        panels_block += right_text + "\n"

    final_content = new_content[:insert_pos] + panels_block + new_content[insert_pos:]

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
    move_panels_outside(f)
