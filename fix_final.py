#!/usr/bin/env python3#
import re#

def find_matching_paren(content, start):
    """Find matching ) for ( at start."""
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
    return -1#

def get_all_arrow_positions(content):
    """Get all '=> (' positions."""
    positions = []
    pos = 0
    while True:
        p = content.find('=> (', pos)
        if p == -1:
            break
        positions.append(p)
        pos = p + 3
    return positions#

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Step 1: Find orphaned props (before export default)
    export_pos = content.find('export default function ')
    if export_pos == -1:
        print("  ERROR: No export default found")
        return False

    print(f"  export default at {export_pos}")

    # Find LeftPanel props
    left_props_pattern = r'^\s*// .*LEFT.*\n\s*const LeftPanel = React\.memo\(\s*\(\s*\{'
    left_match = re.search(left_props_pattern, content[:export_pos], re.MULTILINE)
    left_props = ""
    left_props_end = -1

    if left_match:
        left_start = left_match.start()
        # Find the ( that opens React.memo's argument
        memo_open = content.find('React.memo(', left_start)
        first_paren = content.find('(', memo_open + len('React.memo(') - 1)
        # Find matching ) for that (
        close_paren = find_matching_paren(content, first_paren)
        if close_paren > -1:
            # Include ) and newline
            end = close_paren + 1
            while end < len(content) and content[end] in (' ', '\t', '\n', '\r', ';'):
                end += 1
            left_props = content[left_start:end]
            left_props_end = end
            print(f"  Found LeftPanel props at {left_start}-{end} (len={len(left_props)})")
        else:
            print("  WARNING: Found LeftPanel but couldn't find end")

    # Find RightPanel props
    right_props_pattern = r'^\s*// .*RIGHT.*\n\s*const RightPanel = React\.memo\(\s*\(\s*\{'
    right_match = re.search(right_props_pattern, content[:export_pos], re.MULTILINE)
    right_props = ""
    right_props_end = -1

    if right_match:
        right_start = right_match.start()
        memo_open = content.find('React.memo(', right_start)
        first_paren = content.find('(', memo_open + len('React.memo(') - 1)
        close_paren = find_matching_paren(content, first_paren)
        if close_paren > -1:
            end = close_paren + 1
            while end < len(content) and content[end] in (' ', '\t', '\n', '\r', ';'):
                end += 1
            right_props = content[right_start:end]
            right_props_end = end
            print(f"  Found RightPanel props at {right_start}-{end} (len={len(right_props)})")
        else:
            print("  WARNING: Found RightPanel but couldn't find end")

    # Step 2: Find arrow functions inside the function (after export_pos)
    arrow_positions = get_all_arrow_positions(content)
    arrows_after_export = [p for p in arrow_positions if p > export_pos]

    print(f"  Found {len(arrows_after_export)} '=> (' after export (at {arrows_after_export})")

    # Step 3: Match arrows to props
    # The first arrow after RightPanel props should be LeftPanel's
    # The second arrow (if exists) should be RightPanel's

    components = []

    if left_props and len(arrows_after_export) >= 1:
        # Find the first arrow and its matching ))
        arrow1 = arrows_after_export[0]
        # Find matching )) for the ( in => (
        paren_open = content.find('(', arrow1 + 3)
        close_paren = find_matching_paren(content, paren_open)
        if close_paren > -1:
            jsx_end = close_paren + 1
            while jsx_end < len(content) and content[jsx_end] in (' ', '\t', '\n', '\r', ';'):
                jsx_end += 1
            jsx_body = content[arrow1:jsx_end]
            # Combine: props + ) => ( + jsx_body
            # Clean up props - remove trailing ) and whitespace
            left_props_clean = left_props.rstrip()
            if left_props_clean.endswith(')'):
                left_props_clean = left_props_clean[:-1]
            full_left = left_props_clean + ') => (\n' + jsx_body + '\n'
            components.append(('LeftPanel', full_left, left_start, left_props_end, arrow1, jsx_end))
            print(f"  Combined LeftPanel: {left_start}-{jsx_end} (total len={len(full_left)})")
        else:
            print("  WARNING: Couldn't find end of LeftPanel JSX")

    if right_props and len(arrows_after_export) >= 2:
        arrow2 = arrows_after_export[1]
        paren_open = content.find('(', arrow2 + 3)
        close_paren = find_matching_paren(content, paren_open)
        if close_paren > -1:
            jsx_end = close_paren + 1
            while jsx_end < len(content) and content[jsx_end] in (' ', '\t', '\n', '\r', ';'):
                jsx_end += 1
            jsx_body = content[arrow2:jsx_end]
            right_props_clean = right_props.rstrip()
            if right_props_clean.endswith(')'):
                right_props_clean = right_props_clean[:-1]
            full_right = right_props_clean + ') => (\n' + jsx_body + '\n'
            components.append(('RightPanel', full_right, right_start, right_props_end, arrow2, jsx_end))
            print(f"  Combined RightPanel: {right_start}-{jsx_end} (total len={len(full_right)})")
        else:
            print("  WARNING: Couldn't find end of RightPanel JSX")

    if not components:
        print("  WARNING: No components to move")
        return False

    # Step 4: Remove all parts from content
    removals = []
    for name, full, props_start, props_end, arrow_start, jsx_end in components:
        removals.append((props_start, props_end))
        removals.append((arrow_start, jsx_end))

    removals.sort(reverse=True)

    new_content = content
    for start, end in removals:
        new_content = new_content[:start] + new_content[end:]

    # Step 5: Insert components before export default
    export_pos2 = new_content.find('export default function ')
    if export_pos2 == -1:
        print("  ERROR: Export line not found after removal")
        return False

    comp_block = ""
    for name, full, props_start, props_end, arrow_start, jsx_end in sorted(components, key=lambda x: x[1]):  # Sort by original position
        comp_block += full + '\n'

    final_content = new_content[:export_pos2] + comp_block + '\n' + new_content[export_pos2:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  SUCCESS: Fixed {filepath}")
    return True#

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
