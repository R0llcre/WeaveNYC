declare module '*.svg' {
  import type { SvgProps } from 'react-native-svg';
  import type { FC } from 'react';
  const Component: FC<SvgProps>;
  export default Component;
}
