<script setup lang="ts">
import { computed } from "vue";

const colorMode = useColorMode()

const isDark = computed({
  get () {
    return colorMode.value === 'dark'
  },
  set (value) {
    colorMode.preference = value ? 'dark' : 'light'
  }
})
</script>


