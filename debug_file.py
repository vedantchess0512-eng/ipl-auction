#!/usr/bin/env python3

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
    return -1

def debug_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"File: {filepath}")
    print(f"Length: {len(content)}")

    # Find all occurrences of 'const LeftPanel = React.memo('
    pos = 0
    while True:
        p = content.find('const LeftPanel = React.memo(', pos)
        if p == -1:
            break
        print(f"\nFound 'const LeftPanel' at {p}")
        # Find first ( after React.memo
        memo = content.find('React.memo(', p)
        print(f"  React.memo( at {memo}")
        first_p = content.find('(', memo + len('React.memo(') - 1)
        print(f"  First ( at {first_p}")
        # Find matching )
        matching = find_matching_paren(content, first_p)
        print(f"  Matching ) at {matching}")
        if matching > -1:
            # Show context
            snippet = content[p:matching+2].replace('\n', ' ').replace('\r', ' ')
            print(f"  Snippet: {snippet[:200]}...")
        pos = p + 1

    # Find all occurrences of 'const RightPanel = React.memo('
    pos = 0
    while True:
        p = content.find('const RightPanel = React.memo(', pos)
        if p == -1:
            break
        print(f"\nFound 'const RightPanel' at {p}")
        memo = content.find('React.memo(', p)
        print(f"  React.memo( at {memo}")
        first_p = content.find('(', memo + len('React.memo(') - 1)
        print(f"  First ( at {first_p}")
        matching = find_matching_paren(content, first_p)
        print(f"  Matching ) at {matching}")
        if matching > -1:
            snippet = content[p:matching+2].replace('\n', ' ').replace('\r', ' ')
            print(f"  Snippet: {snippet[:200]}...")
        pos = p + 1

    # Find export default
    export_pos = content.find('export default function ')
    print(f"\nexport default function at {export_pos}")
    if export_pos > 0:
        snippet = content[max(0,export_pos-50):export_pos+50].replace('\n', ' ').replace('\r', ' ')
        print(f"  Context: {snippet}...")

debug_file(r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx")
print("\n" + "="*80)
debug_file(r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx")
