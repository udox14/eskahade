'use client'

import { Box, Flex, Text, Title } from '@mantine/core'

type DashboardPageHeaderProps = {
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function DashboardPageHeader({
  title,
  description,
  action,
  className,
}: DashboardPageHeaderProps) {
  return (
    <Flex
      className={className}
      direction={{ base: 'column', xs: 'row' }}
      gap="xs"
      align={{ base: 'stretch', xs: 'flex-start' }}
      justify={{ xs: 'space-between' }}
    >
      <Box style={{ minWidth: 0 }}>
        <Title order={1} fw={700} lh={1.2} c="dark.8" fz={{ base: '1.5rem', xs: '1.75rem' }}>
          {title}
        </Title>
        <Text mt={4} size="sm" c="dimmed" lh={1.4}>
          {description}
        </Text>
      </Box>
      {action ? (
        <Box w={{ base: '100%', xs: 'auto' }} style={{ flexShrink: 0 }}>
          {action}
        </Box>
      ) : null}
    </Flex>
  )
}
