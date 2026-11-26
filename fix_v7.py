#!/usr/bin/env python3#
/usr/bin/env python3
import re

def find_matching_paren(content, start):
    """Find matching ) for ( at position start."""
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

def find_components(content):
    """
    Returns list of (name, full_component, start, end).
    """
    results = []

    for name in ['LeftPanel', 'RightPanel']:
        # Find: const Name = React.memo(
        pattern = 'const ' + name + ' = React.memo('
        pos = content.find(pattern)
        if pos == -1:
            print(f"  {name} not found")
            continue

        # Find the first ( after React.memo(
        memo_open = content.find('(', pos + len(pattern) - 1)

        # Find matching ) for that (
        end_paren = find_matching_paren(content, memo_open)
        if end_paren == -1:
            print(f"  Could not find end of {name}")
            continue

        # Include ) and trailing whitespace/semicolon
        end = end_paren + 1
        while end < len(content) and content[end] in (' ', '\t', '\n', '\r', ';'):
            end += 1

        component_text = content[pos:end]
        results.append((name, component_text, pos, end))
        print(f"  Found {name}: {pos}-{end} (len={len(component_text)})")

    return results

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Find export default function
    export_pos = content.find('export default function ')
    if export_pos == -1:
        print("  ERROR: Could not find export default function")
        return False

    components = find_components(content)

    if not components:
        print("  WARNING: No components found")
        return False

    # Remove components from content (highest position first)
    sorted_comps = sorted(components, key=lambda x: x[2], reverse=True)

    new_content = content
    for name, text, start, end in sorted_comps:
        new_content = new_content[:start] + new_content[end:]

    # Now insert components before export default
    export_pos2 = new_content.find('export default function ')
    if export_pos2 == -1:
        print("  ERROR: export line not found after removal")
        return False

    # Build components block
    comp_block = ""
    for name, text, start, end in sorted(components, key=lambda x: x[2]):  # Sort by original position
        comp_block += text + '\n'

    final_content = new_content[:export_pos2] + comp_block + '\n' + new_content[export_pos2:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  SUCCESS: Moved {len(components)} component(s) outside in {filepath}")
    return True

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
