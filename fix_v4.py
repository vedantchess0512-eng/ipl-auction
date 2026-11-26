#!/usr/bin/env python3
import re

def find_matching_paren(content, start):
    """Find the index of the matching closing ) for a ( at start."""
    count = 1
    in_str = False
    str_char = None
    i = start + 1
    while i < len(content):
        c = content[i]
        if in_str:
            if c == str_char and content[i-1] != '\\':
                in_str = False
            i += 1
            continue
        if c in ('"', "'"):
            in_str = True
            str_char = c
        elif c == '(':
            count += 1
        elif c == ')':
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def extract_component(content, const_name):
    """
    Extract full: const X = React.memo(({ props }) => ( <jsx>...</jsx> ))
    Returns (full_text, start, end) or (None, -1, -1).
    """
    # Find: const LeftPanel = React.memo((
    pattern = r'const ' + const_name + r' = React\.memo\(\s*\(\s*\{'
    match = re.search(pattern, content, re.MULTILINE)
    if not match:
        return None, -1, -1

    start = match.start()

    # Find the first ( after React.memo
    memo_pos = content.find('React.memo(', match.start())
    if memo_pos == -1:
        return None, -1, -1

    # Find the ( that opens React.memo's argument
    first_paren = content.find('(', memo_pos + len('React.memo(') - 1)
    if first_paren == -1:
        return None, -1, -1

    # Find the matching ) for React.memo(
    end_paren = find_matching_paren(content, first_paren)
    if end_paren == -1:
        return None, -1, -1

    # Include trailing ) and semicolon/newlines
    end = end_paren + 1
    while end < len(content) and content[end] in (' ', '\t', '\n', '\r', ';'):
        end += 1

    full_text = content[start:end]
    return full_text, start, end

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Find ALL components in the file
    components = []
    for name in ['LeftPanel', 'RightPanel']:
        full_text, start, end = extract_component(content, name)
        if full_text:
            components.append((name, full_text, start, end))
            print(f"  Found {name} at {start}-{end}")

    if not components:
        print("  WARNING: No components found in file")
        return False

    # Sort by position (descending) so we don't mess up indices when removing
    components.sort(key=lambda x: x[2], reverse=True)

    # Remove all components from the file
    new_content = content
    for name, text, start, end in components:
        new_content = new_content[:start] + new_content[end:]

    # Now insert components before export default
    export_pattern = r'^(export default function \w+\(\)\s*\{)'
    export_match = re.search(export_pattern, new_content, re.MULTILINE)
    if not export_match:
        print("  ERROR: Could not find export default function")
        return False

    insert_pos = export_match.start()

    # Build components block
    components_block = ""
    for name, text, start, end in sorted(components, key=lambda x: x[1]):  # Sort by name
        components_block += text + "\n\n"

    # Insert before export
    final_content = new_content[:insert_pos] + components_block + new_content[insert_pos:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  SUCCESS: Fixed {filepath}")
    return True

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
