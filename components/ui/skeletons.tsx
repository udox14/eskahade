// Reusable skeleton components untuk Suspense fallbacks (Mantine)

import { Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core'

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
      {[...Array(count)].map((_, i) => (
        <Paper key={i} withBorder radius="lg" p="lg">
          <Skeleton height={12} width={80} radius="sm" mb={12} />
          <Skeleton height={32} width={64} radius="sm" mb={8} />
          <Skeleton height={12} width={48} radius="sm" />
        </Paper>
      ))}
    </SimpleGrid>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <Group gap="md" px="lg" py="sm" bg="gray.0" wrap="nowrap">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} height={12} radius="sm" style={{ flex: 1 }} />
        ))}
      </Group>
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <Group key={i} gap="md" px="lg" py="md" wrap="nowrap" style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
          <Skeleton height={16} width={144} radius="sm" />
          <Skeleton height={16} width={80} radius="sm" />
          <Skeleton height={16} radius="sm" style={{ flex: 1 }} />
          <Skeleton height={16} width={96} radius="sm" />
          <Skeleton height={24} width={56} radius="xl" />
        </Group>
      ))}
    </Paper>
  )
}

export function CardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Stack gap="xs">
      {[...Array(count)].map((_, i) => (
        <Paper key={i} withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm" align="flex-start">
            <Stack gap={6}>
              <Skeleton height={16} width={160} radius="sm" />
              <Skeleton height={12} width={96} radius="sm" />
            </Stack>
            <Skeleton height={20} width={56} radius="xl" />
          </Group>
          <Skeleton height={12} radius="sm" mb="sm" />
          <Group gap="xs" grow>
            <Skeleton height={32} radius="md" />
            <Skeleton height={32} radius="md" />
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}

export function DashboardHeroSkeleton() {
  return <Skeleton height={176} radius="lg" />
}

export function DetailSkeleton() {
  return (
    <Stack gap="lg">
      {/* Header */}
      <Group gap="md">
        <Skeleton height={40} circle />
        <Stack gap={8}>
          <Skeleton height={24} width={192} radius="sm" />
          <Skeleton height={16} width={128} radius="sm" />
        </Stack>
      </Group>
      {/* Card info */}
      <Paper withBorder radius="lg" p="lg">
        <Group gap="xl" align="flex-start" wrap="nowrap">
          <Skeleton height={96} width={96} circle />
          <Stack gap="sm" style={{ flex: 1 }}>
            <Skeleton height={24} width={192} radius="sm" />
            <Skeleton height={16} width={128} radius="sm" />
            <SimpleGrid cols={2} spacing="sm">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height={16} radius="sm" />
              ))}
            </SimpleGrid>
          </Stack>
        </Group>
      </Paper>
      {/* Tabs */}
      <Group gap="xs">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height={36} width={96} radius="md" />
        ))}
      </Group>
      {/* Content */}
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={16} radius="sm" />
          ))}
        </Stack>
      </Paper>
    </Stack>
  )
}
