import { styled } from 'styled-system/jsx'
import type { ComponentProps } from 'react'

export type HeadingProps = ComponentProps<typeof Heading>
export const Heading = styled('h2', {
  base: {
    fontWeight: 'semibold',
    color: 'fg.default',
  },
})
