<script setup lang="ts">
import api from '@/api'
import { useArrayRule, useForm } from '@/composables/form'
import { arrayDiff } from '@/helpers/commons'
import type { FieldProps, FormFieldDict } from '@/types/form'
import {
  emailForward,
  emailLocalPart,
  integer,
  minLength,
  minValue,
  name as nameValidator,
  required,
  sameAs,
} from '@/helpers/validators'
import { formatForm } from '@/helpers/yunohostArguments'
import type { AdressModelValue } from '@/types/form'
import { computed, reactive, ref, type UnwrapRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { ValidationArgs } from '@vuelidate/core'

const asUnreffed = <T,>(value: T): UnwrapRef<T> => value as UnwrapRef<T>
const props = defineProps<{
  name: string
}>()

const { t } = useI18n()
const router = useRouter()
// const { userNames, domainsAsChoices, mainDomain } = useStoreGetters()
const domainsAsChoices = ref<string[]>(['test.com', 'lolilo.com'])
const mainDomain = ref('test.com')
// setTimeout(() => {
//   domainsAsChoices.value = ['test.com', 'lolilo.com']
// }, 2000)
const domains = computed(() => {
  return d.value
})
const userNames = computed(() => ['axo'])

const form = ref({
  username: 'lel',
  fullname: '',
  mail: {
    localPart: '',
    separator: '@',
    domain: null,
  } as AdressModelValue,
  mailbox_quota: 0,
  mail_aliases: [] as AdressModelValue[],
  // mail_forward: [] as { mail: string }[],
  mail_forward: [''] as string[],
  change_password: '',
  confirmation: '',
  check: false,
})
type Form = typeof form.value

const fields_ = reactive({
  btn: {
    component: 'ButtonItem',
    props: {
      id: 'test',
      label: 'lol',
    },
  } satisfies FieldProps<'ButtonItem'>,

  username: {
    component: 'InputItem',
    label: t('user_username'),
    readonly: true,
    // modelValue: props.name,
    visible: true,
    props: { id: 'username' }, //, disabled: true },
  } satisfies FieldProps,

  fullname: {
    component: 'InputItem',
    label: t('user_fullname'),
    rules: { required, name: nameValidator },
    hr: true,
    asInputGroup: true,
    props: {
      id: 'fullname',
      placeholder: t('placeholder.fullname'),
    },
  } satisfies FieldProps<'InputItem', Form['fullname']>,

  mail: {
    component: 'AdressItem',
    label: t('user_email'),
    rules: {
      localPart: { required, email: emailLocalPart },
      domain: { required },
    },
    props: { choices: asUnreffed(domainsAsChoices) },
  } satisfies FieldProps<'AdressItem', Form['mail']>,

  mailbox_quota: {
    component: 'InputItem',
    label: t('user_mailbox_quota'),
    description: t('mailbox_quota_description'),
    // example: t('mailbox_quota_example'),
    rules: { integer, min: minValue(0) },
    append: 'M',
    props: {
      id: 'mailbox-quota',
      type: 'number',
      placeholder: t('mailbox_quota_placeholder'),
    },
  } satisfies FieldProps<'InputItem', Form['mailbox_quota']>,

  mail_aliases: {
    component: 'AdressItem',
    label: t('user_emailaliases'),
    rules: asUnreffed(
      useArrayRule(() => form.value.mail_aliases, {
        localPart: { required, email: emailLocalPart },
      }),
    ),
    // defaultValue: () =>
    //   ({
    //     localPart: '',
    //     separator: '@',
    //     domain: mainDomain.value,
    //   }) as AdressModelValue,
    props: {
      id: 'mail-aliases',
      placeholder: t('placeholder.username'),
      choices: asUnreffed(domainsAsChoices),
    },
  } satisfies FieldProps<'AdressItem', Form['mail_aliases']>,

  mail_forward: {
    component: 'InputItem' as const,
    label: t('user_emailforward'),
    rules: asUnreffed(
      useArrayRule(() => form.value.mail_forward, { required, emailForward }),
    ),
    // defaultValue: () => '',
    props: {
      id: 'mail-forward',
      placeholder: t('user_new_forward'),
      type: 'email',
    },
  } satisfies FieldProps<'InputItem', Form['mail_forward']>,

  change_password: {
    component: 'InputItem',
    label: t('password'),
    description: t('good_practices_about_user_password'),
    descriptionVariant: 'warning',
    rules: { passwordLenght: minLength(8) },
    props: {
      id: 'change_password',
      type: 'password',
      placeholder: '••••••••',
      autocomplete: 'new-password',
    },
  } satisfies FieldProps<'InputItem', Form['change_password']>,

  confirmation: {
    component: 'InputItem',
    label: t('password_confirmation'),
    rules: asUnreffed(
      computed(() => {
        const rules = { passwordMatch: sameAs(form.value.change_password) }
        return form.value.change_password ? { required, ...rules } : rules
      }),
    ),
    props: {
      id: 'confirmation',
      type: 'password',
      placeholder: '••••••••',
      autocomplete: 'new-password',
    },
  } satisfies FieldProps<'InputItem', Form['confirmation']>,

  check: {
    component: 'CheckboxItem',
    label: 'checkbox',
    props: {
      id: 'checkbox',
    },
  } satisfies FieldProps<'CheckboxItem', Form['check']>,
} satisfies FormFieldDict<Form>)

const { v, onSubmit, serverErrors } = useForm(form, fields_)

const updateUser = onSubmit(async (onError, serverErrors) => {
  const formData = await formatForm(form, { removeEmpty: true })
  // FIXME not sure computed can be executed?
  const user_ = user.value(props.name)
  const data = {}
  if (!Object.prototype.hasOwnProperty.call(formData, 'mailbox_quota')) {
    formData.mailbox_quota = ''
  }

  formData.mail_forward = formData.mail_forward?.map((v) => v.mail)

  for (const key of ['mail_aliases', 'mail_forward']) {
    const dashedKey = key.replace('_', '-')
    const newKey = key.replace('_', '').replace('es', '')
    const addDiff = arrayDiff(formData[key], user_[dashedKey])
    const rmDiff = arrayDiff(user_[dashedKey], formData[key])
    if (addDiff.length) data['add_' + newKey] = addDiff
    if (rmDiff.length) data['remove_' + newKey] = rmDiff
  }

  for (const key in formData) {
    if (key === 'mailbox_quota') {
      const quota =
        parseInt(formData[key]) > 0 ? formData[key] + 'M' : 'No quota'
      if (parseInt(quota) !== parseInt(user_['mailbox-quota'].limit)) {
        data[key] = quota === 'No quota' ? '0' : quota
      }
    } else if (!key.includes('mail_') && formData[key] !== user_[key]) {
      data[key] = formData[key]
    }
  }

  if (Object.keys(data).length === 0) {
    serverErrors.global = [t('error_modify_something')]
    return
  }

  api
    .put({ uri: 'users', param: props.name, storeKey: 'users_details' }, data, {
      key: 'users.update',
      name: props.name,
    })
    .then(() => {
      router.push({ name: 'user-info', param: { name: props.name } })
    })
    .catch(onError)
})
</script>

<template>
  <ViewBase>
    {{ form }}<br /><br />
    {{ v.form.$errors }}

    <CardForm
      v-model="form"
      :title="$t('user_username_edit', { name: props.name })"
      icon="user"
      :fields="fields_"
      :validations="v"
      @submit.prevent="updateUser"
    >
      <template #field:mail_aliases="fieldProps">
        <FormFieldMultiple
          v-bind="fieldProps"
          v-model="form.mail_aliases"
          :add-btn-text="t('user_emailaliases_add')"
          :validation="v.form.mail_aliases"
        />
      </template>

      <template #field:mail_forward="fieldProps">
        <FormFieldMultiple
          v-bind="fieldProps"
          v-model="form.mail_forward"
          :add-btn-text="t('user_emailforward_add')"
          :validation="v.form.mail_forward"
        />
      </template>
    </CardForm>

    <FormFieldMultiple
      v-bind="fields_.mail_forward"
      v-model="form.mail_forward"
      :add-btn-text="t('user_emailaliases_add')"
      :validation="v.form.mail_forward"
    >
      <template #default="{ componentProps, index }">
        <InputItem v-bind="componentProps" v-model="form.mail_forward[index]" />
      </template>
    </FormFieldMultiple>

    <!-- FIXME have to pass model-value to get value type in not in CardForm -->
    <FormField
      v-bind="fields_.mail"
      :model-value="form.mail"
      :validation="v.form.mail"
    >
      <template #default="componentProps">
        <AdressItem v-bind="componentProps" v-model="form.mail" />
      </template>
    </FormField>
  </ViewBase>
</template>
