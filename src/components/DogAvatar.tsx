"use client";

import Image from "next/image";

export default function DogAvatar({ size = 56 }: { size?: number }) {
  return (
    <Image
      src="/dog-avatar.png"
      alt="Dog avatar"
      width={size}
      height={size}
      className="rounded-full object-cover"
      priority
    />
  );
}
