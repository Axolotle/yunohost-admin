import type {
  BaseValidation,
  ServerErrors,
  ValidationArgs,
  ValidationRuleCollection,
} from '@vuelidate/core'
import useVuelidate from '@vuelidate/core'
import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import { computed, inject, provide, reactive, toValue } from 'vue'

import { APIBadRequestError, type APIError } from '@/api/errors'
import type { Obj } from '@/types/commons'
import type { FormField, FormFieldDict } from '@/types/form'

export const clearServerErrorsSymbol = Symbol() as InjectionKey<
  (key?: string) => void
>
export const ValidationTouchSymbol = Symbol() as InjectionKey<
  (key?: string) => void
>

export function useTouch(
  validation: MaybeRefOrGetter<BaseValidation | undefined>,
) {
  function touch(key?: string) {
    const v = toValue(validation)
    if (v) {
      // For fields that have multiple elements
      if (key) {
        v[key].$touch()
        clear?.(v[key].$path)
      } else {
        v.$touch()
        clear?.(v.$path)
      }
    }
  }
  provide(ValidationTouchSymbol, touch)
  const clear = inject(clearServerErrorsSymbol)

  return touch
}

export function useForm<T extends Obj, F extends FormFieldDict<T>>(
  form: Ref<T>,
  fields: F,
) {
  const serverErrors = reactive<ServerErrors>({})
  const validByDefault: ValidationRuleCollection = { true: () => true }

  const rules = computed(() => {
    const validations = Object.keys(form.value).map((key: keyof T) => [
      key,
      (fields[key] as FormField).rules ?? validByDefault,
    ])
    const rules: ValidationArgs<T> = Object.fromEntries(validations)
    return {
      // create a fake validation rule for global state to be able to add $externalResult errors to it
      global: { true: () => true },
      form: rules,
    }
  })

  const v = useVuelidate(
    rules,
    { form, global: null },
    { $externalResults: serverErrors },
  )

  function onErrorFn(err: APIError, errorMessage?: string) {
    if (!(err instanceof APIBadRequestError)) throw err
    if (errorMessage) {
      serverErrors.global = [errorMessage]
    } else {
    serverErrors[err.data.name ?? 'global'] = [err.message]
    }
  }

  function onSubmit(
    fn: (onError: typeof onErrorFn, serverErrors: ServerErrors) => void,
  ) {
    // FIXME add option to ask confirmation (with param text confirm)
    return async (e: SubmitEvent) => {
      e.preventDefault()
      if (!(await v.value.$validate())) return
      fn(onErrorFn, serverErrors)
    }
  }

  function deepSetErrors(
    obj: ServerErrors,
    value: string[],
    ...keys: string[]
  ) {
    const [k, ...ks] = keys
    if (ks.length) {
      if (!(k in obj) && !value.length) {
        obj[k] = {}
        deepSetErrors(obj[k] as ServerErrors, value, ...ks)
      } else if (k in obj) {
        deepSetErrors(obj[k] as ServerErrors, value, ...ks)
      }
    } else {
      if (!(k in obj) && !value.length) return
      obj[k] = value
    }
  }

  provide(clearServerErrorsSymbol, (key?: string) => {
    const keys = key?.split('.')
    if (keys?.length) {
      deepSetErrors(serverErrors, [], ...keys)
    }
  })

  return {
    v,
    serverErrors,
    onSubmit,
  }
}
