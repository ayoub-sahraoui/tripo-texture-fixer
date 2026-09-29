import { styled } from 'styled-system/jsx'
import { text } from 'styled-system/recipes'
import type { ComponentProps } from 'react'

export type TextProps = ComponentProps<typeof Text>
export const Text = styled('p', text)
