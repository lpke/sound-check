import { Panel } from './UI';

export function UnsupportedPanel() {
  return (
    <Panel title="Browser support">
      <p className="text-danger text-sm">
        This browser does not expose the media device APIs required for audio
        testing.
      </p>
    </Panel>
  );
}
