<script setup lang="ts">
import data from '@/types/config.json'
import { computed, isRef, reactive, ref } from 'vue'

import api, { objectToParams } from '@/api'
import ConfigPanelsComponent from '@/components/ConfigPanels.vue'
import type {
  ConfigPanelsProps,
  OnPanelApply,
  UnwrappedConfigPanelsProps,
} from '@/composables/configPanels'
import { formatConfigPanels, useConfigPanels } from '@/composables/configPanels'
import type { Obj } from '@/types/commons'
import type { CoreConfigPanels } from '@/types/core/options'
import { onUpdated } from 'vue'
import { shallowRef } from 'vue'

// const { loading, refetch } = useInitialQueries([['GET', 'settings?full']], {
//   onQueriesResponse,
// })
const props = defineProps<{ tabId?: string }>()
const config = shallowRef<ConfigPanelsProps | undefined>()
// FIXME user proper useValidate stuff
const externalResults = reactive({})

// function onQueriesResponse(config_: any) {

const onPanelApply: OnPanelApply = ({ panelId, form }, onError) => {
  console.log('onConfigSubmit', form)
  // config.value.onSubmit(() => {

  // })
  // const args = await formatForm(form, {
  //   removeEmpty: false,
  //   removeNull: true,
  // })

  // FIXME no route for potential action
  api
    .put(
      `settings/${panelId}`,
      { args: objectToParams(form) },
      { key: 'settings.update', panel: panelId },
    )
    .then(() => refetch())
    .catch(onError)
  // .catch((err: APIError) => {
  //   if (!(err instanceof APIBadRequestError)) throw err
  //   const panel = config.value.panels.find((panel) => panel.id === id)
  //   if (err.data.name) {
  //     Object.assign(externalResults, {
  //       forms: { [panel.id]: { [err.data.name]: [err.data.error] } },
  //     })
  //   } else {
  //     panel.serverError = err.message
  //   }
  // })
}

console.log('onPanelApplyfn', onPanelApply)
function onQueriesResponse() {
  // config.value = formatYunoHostConfigPanels(data)

  data.panels.unshift({
    // hasApplyButton: false,
    id: 'operations',
    name: 'operations',
  })
  config.value = useConfigPanels(
    formatConfigPanels(data as CoreConfigPanels<Obj<Obj>>),
    () => props.tabId,
    onPanelApply,
  )
  console.log('CONFIG', isRef(config.value.panel))
}

const tabId = computed(() => props.tabId || config.value?.panels[0].id)
onUpdated(() => console.log('onUpdated'))
onQueriesResponse()
</script>

<template>
  <ViewBase v-if="config" skeleton="CardFormSkeleton">
    <ConfigPanelsComponent
      v-if="config"
      v-model="config.form"
      :panel="config.panel.value"
      :validations="config.v.value"
      :routes="config.routes"
      @apply="config.onPanelApply"
    >
      <template v-if="tabId === 'operations'" #default>
        coucou
      </template>
    </ConfigPanelsComponent>
  </ViewBase>
</template>
