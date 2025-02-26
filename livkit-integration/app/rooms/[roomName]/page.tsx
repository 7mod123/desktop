import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';

export default function Page({
  params,
  searchParams,
}: {
  params: { roomName: string };
  searchParams: {
    region?: string;
  };
}) {
  return <PageClientImpl roomName={params.roomName} region={searchParams.region} />;
}
