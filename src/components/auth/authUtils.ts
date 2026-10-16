import type { FormEvent } from 'react'

export function preventDefaultSubmit(handler: () => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handler()
  }
}