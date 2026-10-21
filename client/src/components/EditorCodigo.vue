<template>
  <div ref="contenedor" class="editor-codigo"></div>
</template>

<script setup>
// Editor de código basado en CodeMirror 6 (resaltado de sintaxis, números de línea,
// autocierre de paréntesis, Tab para indentar). Se usa con v-model.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'

const props = defineProps({
  modelValue: { type: String, default: '' },
  lenguaje: { type: String, default: 'python' }, // 'python' | 'cpp'
  soloLectura: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const contenedor = ref(null)
const compartimentoLenguaje = new Compartment()
const compartimentoLectura = new Compartment()
let vista = null

const extensionLenguaje = (l) => (l === 'cpp' ? cpp() : python())

const tema = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: '#FFFFFF' },
  '.cm-scroller': { fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', monospace", lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: '#F6F7FA', color: '#8A94A6', borderRight: '1px solid #DDE2EB' },
  '.cm-activeLineGutter': { backgroundColor: '#E9EDF5' },
  '.cm-activeLine': { backgroundColor: 'rgba(32,44,69,0.04)' },
  '&.cm-focused': { outline: 'none' }
})

onMounted(() => {
  vista = new EditorView({
    parent: contenedor.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        indentUnit.of('    '),
        tema,
        compartimentoLenguaje.of(extensionLenguaje(props.lenguaje)),
        compartimentoLectura.of(EditorState.readOnly.of(props.soloLectura)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        })
      ]
    })
  })
})

// Si el código cambia desde afuera (otro problema, restaurar plantilla), actualizar el editor
watch(() => props.modelValue, (nuevo) => {
  if (!vista) return
  const actual = vista.state.doc.toString()
  if (nuevo !== actual) {
    vista.dispatch({ changes: { from: 0, to: actual.length, insert: nuevo ?? '' } })
  }
})

watch(() => props.lenguaje, (l) => {
  vista?.dispatch({ effects: compartimentoLenguaje.reconfigure(extensionLenguaje(l)) })
})

watch(() => props.soloLectura, (v) => {
  vista?.dispatch({ effects: compartimentoLectura.reconfigure(EditorState.readOnly.of(v)) })
})

onBeforeUnmount(() => {
  vista?.destroy()
  vista = null
})
</script>

<style scoped>
.editor-codigo {
  height: 100%;
  min-height: 280px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.editor-codigo :deep(.cm-editor) {
  height: 100%;
}
</style>
