# Dialog Component

A flexible, reusable dialog wrapper around PrimeVue's Dialog component that standardizes dialog behavior across the application.

## Features

- Supports both `visible` (v-model) and `isEnabled` (watch) patterns
- Configurable PrimeVue props (modal, draggable, closable, closeOnEscape)
- Customizable width and styling
- Slot-based content (header, default, footer)

## Usage

### Basic Example

```vue
<template>
  <Dialog :visible="isOpen" width="40rem" @update:visible="isOpen = $event">
    <template #header>
      <h2>My Dialog</h2>
    </template>

    <p>Dialog content goes here</p>

    <template #footer>
      <button @click="isOpen = false">Close</button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue';
import Dialog from '@/components/Dialog';

const isOpen = ref(false);
</script>
```

### With v-model

```vue
<template>
  <Dialog v-model:visible="isOpen" width="30rem" :closable="true">
    <template #header>
      <h2>Closable Dialog</h2>
    </template>

    <p>This dialog can be closed with the X button</p>
  </Dialog>
</template>
```

### Backward Compatible (isEnabled pattern)

```vue
<template>
  <Dialog :is-enabled="modalEnabled" @modal-closed="handleClose">
    <template #header>
      <h2>Legacy Pattern</h2>
    </template>

    <p>Compatible with original Dialog API</p>
  </Dialog>
</template>
```

## Props

| Prop            | Type    | Default     | Description                                          |
| --------------- | ------- | ----------- | ---------------------------------------------------- |
| `visible`       | Boolean | `undefined` | Controls dialog visibility (v-model compatible)      |
| `isEnabled`     | Boolean | `undefined` | Alternative visibility control (backward compatible) |
| `modal`         | Boolean | `true`      | Whether dialog is modal                              |
| `draggable`     | Boolean | `false`     | Whether dialog can be dragged                        |
| `closable`      | Boolean | `false`     | Whether dialog shows close button                    |
| `closeOnEscape` | Boolean | `false`     | Whether ESC key closes dialog                        |
| `width`         | String  | `undefined` | Dialog width (e.g., '40rem', '500px')                |
| `dialogClass`   | String  | `'w-128'`   | Additional CSS classes                               |

## Events

| Event            | Payload | Description                               |
| ---------------- | ------- | ----------------------------------------- |
| `update:visible` | Boolean | Emitted when visibility changes (v-model) |
| `modalClosed`    | -       | Emitted when dialog is closed             |

## Slots

| Slot      | Description           |
| --------- | --------------------- |
| `header`  | Dialog header content |
| `default` | Main dialog content   |
| `footer`  | Dialog footer content |

## Examples

### Dynamic Closable

```vue
<Dialog :visible="showDialog" :closable="!isProcessing" @update:visible="showDialog = $event">
  <template #header>
    <h2>{{ isProcessing ? 'Processing...' : 'Ready' }}</h2>
  </template>
  
  <p>{{ message }}</p>
</Dialog>
```

### Custom Width

```vue
<Dialog :visible="showDialog" width="60rem" dialog-class="custom-dialog">
  <!-- content -->
</Dialog>
```

## Migration from PvDialog

**Before:**

```vue
<PvDialog
  :visible="isOpen"
  :modal="true"
  :draggable="false"
  :closable="false"
  :style="{ width: '40rem' }"
  @update:visible="isOpen = $event"
>
  <!-- content -->
</PvDialog>
```

**After:**

```vue
<Dialog :visible="isOpen" width="40rem" @update:visible="isOpen = $event">
  <!-- content -->
</Dialog>
```

## Design Decisions

1. **Dual Pattern Support**: Supports both `visible` and `isEnabled` for flexibility and backward compatibility
2. **Sensible Defaults**: `modal=true`, `draggable=false`, `closable=false` match common use cases
3. **Style Flexibility**: Accepts both `width` prop and `dialogClass` for styling
4. **Zero Footer Padding**: Maintains original styling with `:deep(.p-dialog .p-dialog-footer) { padding: 0; }`

## Related Components

- `OrgExportModal` - Uses Dialog with dynamic closable based on export state
- `RoarModal` - Could be migrated to use Dialog for consistency
