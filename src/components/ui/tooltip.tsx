'use client'
import { Portal } from '@ark-ui/react/portal'
import { Tooltip as ArkTooltip } from '@ark-ui/react/tooltip'
import { type ComponentProps, forwardRef } from 'react'
import { createStyleContext } from 'styled-system/jsx'
import { tooltip } from 'styled-system/recipes'

const { withRootProvider, withContext } = createStyleContext(tooltip)

type RootProps = ComponentProps<typeof Root>
type ContentProps = ComponentProps<typeof Content>
const Root = withRootProvider(ArkTooltip.Root, {
  defaultProps: { unmountOnExit: true, lazyMount: true },
})
const Content = withContext(ArkTooltip.Content, 'content')
const Positioner = withContext(ArkTooltip.Positioner, 'positioner')
const Trigger = withContext(ArkTooltip.Trigger, 'trigger')

export { TooltipContext as Context } from '@ark-ui/react/tooltip'

export interface TooltipProps extends Omit<RootProps, 'content'> {
  children: React.ReactNode | undefined
  content: React.ReactNode | string
  contentProps?: ContentProps
  disabled?: boolean
  shortcut?: string
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(props, ref) {
  const {
    children,
    disabled,
    content,
    contentProps,
    shortcut,
    ...rootProps
  } = props

  if (disabled) return <>{children}</>

  return (
    <Root {...rootProps} openDelay={300} closeDelay={100}>
      <Trigger asChild>{children}</Trigger>
      <Portal>
        <Positioner>
          <Content ref={ref} {...contentProps}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {content}
              {shortcut && (
                <kbd style={{
                  padding: '1px 4px',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  {shortcut}
                </kbd>
              )}
            </span>
          </Content>
        </Positioner>
      </Portal>
    </Root>
  )
})
