'use client'

import { AspectRatio, Box, Center, Image, Modal, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

type SantriPhotoAvatarProps = {
  src?: string | null
  alt?: string
  name: string
  size?: 'sm' | 'md'
  clickable?: boolean
  className?: string
}

// Dimensi portrait (sm: 40×53.6px, md: 48×64px) — sama dengan versi Tailwind lama
const sizeMap = {
  sm: { w: 40, h: 53.6 },
  md: { w: 48, h: 64 },
} as const

function getInitials(name: string) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

export function SantriPhotoAvatar({
  src,
  alt,
  name,
  size = 'md',
  clickable = true,
  className,
}: SantriPhotoAvatarProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const hasPhoto = Boolean(src)
  const canOpen = hasPhoto && clickable
  const { w, h } = sizeMap[size]

  const frame = (
    <Box
      className={className}
      w={w}
      h={h}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-gray-1)',
        boxShadow: 'var(--mantine-shadow-sm)',
        flexShrink: 0,
      }}
    >
      {hasPhoto ? (
        <Image src={src!} alt={alt || name} w={w} h={h} fit="cover" />
      ) : (
        <Center
          w="100%"
          h="100%"
          style={{
            background: 'linear-gradient(to bottom right, var(--mantine-color-gray-2), var(--mantine-color-gray-1))',
          }}
        >
          <Text size="11px" fw={900} tt="uppercase" c="gray.6" style={{ letterSpacing: '0.05em' }}>
            {getInitials(name)}
          </Text>
        </Center>
      )}
    </Box>
  )

  if (!canOpen) return frame

  return (
    <>
      <UnstyledButton
        onClick={(event) => {
          event.stopPropagation()
          open()
        }}
        aria-label={`Lihat foto ${name}`}
        style={{ flexShrink: 0, borderRadius: 8 }}
      >
        {frame}
      </UnstyledButton>

      <Modal opened={opened} onClose={close} centered size="md" padding={0} title={null} radius="md">
        <AspectRatio ratio={3 / 4}>
          <Image src={src!} alt={alt || name} fit="cover" />
        </AspectRatio>
      </Modal>
    </>
  )
}
