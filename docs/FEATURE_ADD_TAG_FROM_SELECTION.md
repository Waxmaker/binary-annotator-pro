# Feature: Add Tag to Config from Hex Selection

## Overview

This feature allows users to quickly create YAML tags from byte selections in the HexViewer using a right-click context menu. Tags are automatically added to the YAML configuration and applied immediately for visual feedback.

## User Workflow

### 1. Select Bytes in HexViewer
- Click and drag in the hex viewer to select a range of bytes
- Selection information (start offset, end offset, size) is displayed in the status bar

### 2. Right-Click Menu
- Right-click anywhere in the hex viewer
- Context menu appears with "Add to config" option
- Option is only enabled if bytes are currently selected

### 3. Add Tag Dialog
- Dialog opens with:
  - **Selected Range**: Shows offset range and size (auto-filled, read-only)
  - **Tag Name**: Input field for the tag identifier (required)
  - **Color**: Color picker with preset palette

### 4. Automatic YAML Generation
- Click "Add Tag" button (or press Enter)
- Tag is automatically added to the YAML text in the `tags:` section
- Format:
  ```yaml
  tags:
    my_tag_name:
      offset: 0x1234
      size: 256
      color: "#FF6B9D"
  ```
- Changes are applied immediately - highlight appears in the hex viewer

## Implementation Details

### Components Created

1. **`HexViewerContextMenu.tsx`**
   - Right-click context menu component
   - Shows "Add to config" option
   - Disabled state when no selection

2. **`AddTagDialog.tsx`**
   - Dialog with tag name and color inputs
   - Displays selection information
   - Color picker with 15 preset colors
   - Validation (tag name required)

3. **`yamlTagAdder.ts`**
   - Utility function `addTagToYaml()`
   - Parses existing YAML
   - Adds new tag to `tags:` section
   - Checks for duplicate tag names
   - Generates properly formatted YAML

### Modified Components

4. **`HexViewer.tsx`**
   - Added `onAddTag` prop callback
   - Context menu state management
   - Dialog state management
   - **Performance optimization**: Uses `useRef` for `selection` and `onAddTag` to prevent unnecessary re-renders

5. **`Index.tsx`**
   - `handleAddTag()` callback implementation
   - Uses `yamlTextRef` to avoid dependency issues
   - Calls `updateYaml()` to apply changes
   - Toast notifications for success/error

6. **`useYamlConfig.ts`**
   - Fixed bug: Check `response.matches` for null/undefined before iterating

## Technical Challenges Solved

### React Error #310 (Too Many Re-renders)

**Problem**: `useCallback` hooks with unstable dependencies caused infinite re-render loop.

**Solutions Applied**:
1. **Index.tsx**: Used `useRef` for `yamlText` to avoid recreating `handleAddTag` on every YAML change
   ```typescript
   const yamlTextRef = useRef(yamlText);
   yamlTextRef.current = yamlText;
   ```

2. **HexViewer.tsx**: Used `useRef` for `selection` and `onAddTag` props
   ```typescript
   const selectionRef = useRef(selection);
   const onAddTagRef = useRef(onAddTag);
   ```

3. **Empty dependency arrays**: Callbacks use refs instead of direct state/prop dependencies

### Browser Cache Issues

After rebuilding Docker images, browsers may cache old JavaScript files.

**Solution**: Hard refresh the browser:
- **Mac**: Cmd + Shift + R
- **Windows/Linux**: Ctrl + Shift + R
- **Alternative**: Use incognito/private browsing mode

## File Structure

```
frontend/src/
├── components/
│   ├── HexViewer.tsx          (modified - context menu integration)
│   ├── HexViewerContextMenu.tsx  (new - right-click menu)
│   └── AddTagDialog.tsx       (new - tag creation dialog)
├── pages/
│   └── Index.tsx              (modified - handleAddTag callback)
├── hooks/
│   └── useYamlConfig.ts       (modified - null check fix)
└── utils/
    └── yamlTagAdder.ts        (new - YAML generation utility)
```

## Testing

### Build Commands
```bash
# Frontend build
cd frontend
yarn run build:dev

# Docker rebuild
docker rmi binary-annotator-pro-frontend
docker-compose build frontend
docker-compose up -d
```

### Manual Test Steps
1. Upload a binary file
2. Select bytes in hex viewer (click + drag)
3. Right-click in hex viewer
4. Click "Add to config"
5. Enter tag name: `test_region`
6. Choose a color
7. Click "Add Tag"
8. Verify:
   - Toast notification appears
   - Tag appears in YAML text
   - Highlight appears in hex viewer at correct offset

## Future Enhancements

- [ ] Support for editing existing tags via right-click
- [ ] "Quick add" mode for multiple sequential tags
- [ ] Template tags (e.g., "ECG Lead I", "Patient Header")
- [ ] Copy tag definition to clipboard
- [ ] Drag-to-resize tags in hex viewer
