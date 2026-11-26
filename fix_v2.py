#!/usr/bin/env python3
import re

def find_matching_closing(content, start_char, open_char, close_char):
    """Find the index of the matching close_char for start_char position."""
    count = 1
    in_string = False
    string_char = None
    i = start_char + 1
    while i < len(content):
        c = content[i]
        if in_string:
            if c == string_char and content[i-1] != '\\':
                in_string = False
            i += 1
            continue
        if c in ('"', "'"):
            in_string = True
            string_char = c
        elif c == open_char:
            count += 1
        elif c == close_char:
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def extract_full_component(content, const_name):
    """
    Extract full: const X = React.memo(({ props }) => ( <jsx>...</jsx> ))
    Returns (full_text, start, end) or (None, -1, -1).
    """
    # Find "const LeftPanel = React.memo(" pattern
    pattern = r'const ' + const_name + r' = React\.memo\(\s*\(\s*\(\s*\{'
    match = re.search(pattern, content, re.MULTILINE)
    if not match:
        return None, -1, -1

    start = match.start()

    # Find the first ( after React.memo
    memo_pos = content.find('React.memo(', start)
    if memo_pos == -1:
        return None, -1, -1

    # Find the ( that opens React.memo's argument
    first_paren = content.find('(', memo_pos + len('React.memo(') - 1)
    if first_paren == -1:
        return None, -1, -1

    # Find matching ) for that (
    end_of_memo = find_matching_closing(content, first_paren, '(', ')')
    if end_of_memo == -1:
        return None, -1, -1

    # Include semicolon if present
    end = end_of_memo + 1
    while end < len(content) and content[end] in (' ', '\t', '\n', '\r', ';'):
        end += 1
        if end < len(content) and content[end - 1] == ';':
            break

    full_text = content[start:end]
    return full_text, start, end

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Find export default function line
    export_pattern = r'^(export default function \w+\(\)\s*\{)'
    export_match = re.search(export_pattern, content, re.MULTILINE)
    if not export_match:
        print("  ERROR: Could not find export default function")
        return False

    export_start = export_match.start()

    # Extract components from inside the function body
    # They should be between export_start and end of function
    # But they might have been partially moved already...

    # First, check if there are components OUTSIDE (before export)
    # If so, remove them first
    outside_left, outside_left_start, outside_left_end = extract_full_component(content, 'LeftPanel')
    outside_right, outside_right_start, outside_right_end = extract_full_component(content, 'RightPanel')

    # Remove outside components
    removals = []
    if outside_left and outside_left_start < export_start:
        removals.append((outside_left_start, outside_left_end))
        print(f"  Found LeftPanel outside at {outside_left_start}-{outside_left_end}")
    if outside_right and outside_right_start < export_start:
        removals.append((outside_right_start, outside_right_end))
        print(f"  Found RightPanel outside at {outside_right_start}-{outside_right_end}")

    removals.sort(reverse=True)
    new_content = content
    for start, end in removals:
        new_content = new_content[:start] + new_content[end:]

    # Now find components INSIDE the function
    # Search for them in the function body
    inside_left, inside_left_start, inside_left_end = extract_full_component(new_content, 'LeftPanel')
    inside_right, inside_right_start, inside_right_end = extract_full_component(new_content, 'RightPanel')

    components_to_move = ""

    if inside_left and inside_left_start > export_start:
        print(f"  Found LeftPanel inside at {inside_left_start}-{inside_left_end}")
        components_to_move += inside_left + "\n"
        new_content = new_content[:inside_left_start] + new_content[inside_left_end:]
    elif outside_left:
        components_to_move += outside_left + "\n"

    if inside_right and inside_right_start > export_start:
        print(f"  Found RightPanel inside at {inside_right_start}-{inside_right_end}")
        components_to_move += inside_right + "\n"
        new_content = new_content[:inside_right_start] + new_content[inside_right_end:]
    elif outside_right:
        components_to_move += outside_right + "\n"

    if not components_to_move.strip():
        print("  WARNING: No components found to move")
        return False

    # Now insert components before export default
    export_match2 = re.search(export_pattern, new_content, re.MULTILINE)
    if not export_match2:
        print("  ERROR: export line not found after removal")
        return False

    insert_pos = export_match2.start()
    final_content = new_content[:insert_pos] + components_to_move + "\n" + new_content[insert_pos:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  SUCCESS: Components moved outside in {filepath}")
    return True

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
