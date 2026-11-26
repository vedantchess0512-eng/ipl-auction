#!/usr/bin/env python3

def find_matching_paren(content, start):
    """Find the index of the matching closing ) for a ( at position start."""
    count = 1
    in_string = False
    str_char = None
    i = start + 1
    while i < len(content):
        c = content[i]
        if in_string:
            if c == str_char and content[i-1] != '\\':
                in_string = False
            i += 1
            continue
        if c in ('"', "'"):
            in_string = True
            str_char = c
        elif c == '(':
            count += 1
        elif c == ')':
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def extract_component(content, name):
    """
    Extract full: const Name = React.memo(({ props }) => ( <jsx>...</jsx> ))
    Returns (full_text, start, end) or (None, -1, -1).
    """
    pattern = 'const ' + name + ' = React.memo('
    pos = content.find(pattern)
    if pos == -1:
        return None, -1, -1

    start = pos

    # Find the first ( after React.memo(
    memo_open = content.find('(', pos + len(pattern) - 1)
    if memo_open == -1:
        return None, -1, -1

    # Find matching ) for that (
    end = find_matching_paren(content, memo_open)
    if end == -1:
        return None, -1, -1

    # Include ) and trailing whitespace/semicolon
    end += 1
    while end < len(content) and content[end] in (' ', '\t', '\n', '\r', ';'):
        end += 1

    full_text = content[start:end]
    return full_text, start, end

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Processing {filepath}...")

    # Find export default function
    export_pos = content.find('export default function ')
    if export_pos == -1:
        print("  ERROR: Could not find 'export default function'")
        return False

    print(f"  export default at {export_pos}")

    # Extract components
    components = []
    for name in ['LeftPanel', 'RightPanel']:
        text, start, end = extract_component(content, name)
        if text:
            print(f"  Found {name}: {start}-{end} (len={len(text)})")
            components.append((name, text, start, end))
        else:
            print(f"  {name} not found")

    if not components:
        print("  WARNING: No components found")
        return False

    # Remove components from content (highest position first)
    components.sort(key=lambda x: x[2], reverse=True)

    new_content = content
    for name, text, start, end in components:
        new_content = new_content[:start] + new_content[end:]

    # Now insert components before export default
    export_pos2 = new_content.find('export default function ')
    if export_pos2 == -1:
        print("  ERROR: export line not found after removal")
        return False

    # Build components block
    comp_block = ""
    for name, text, start, end in sorted(components, key=lambda x: x[1]):  # Sort by original position
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
