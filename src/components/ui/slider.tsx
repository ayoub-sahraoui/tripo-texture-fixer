'use client'
import { Slider } from '@ark-ui/react/slider'
import type { ComponentProps } from 'react'
import { createStyleContext } from 'styled-system/jsx'
import { slider } from 'styled-system/recipes'

const { withProvider, withContext } = createStyleContext(slider)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Slider.Root, 'root')
export const Control = withContext(Slider.Control, 'control')
export const Label = withContext(Slider.Label, 'label')
export const Range = withContext(Slider.Range, 'range')
export const Thumb = withContext(Slider.Thumb, 'thumb')
export const Track = withContext(Slider.Track, 'track')
export const ValueText = withContext(Slider.ValueText, 'valueText')
export const HiddenInput = Slider.HiddenInput

export { SliderContext as Context } from '@ark-ui/react/slider'
