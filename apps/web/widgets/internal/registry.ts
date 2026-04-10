import dynamic from 'next/dynamic'
import type { WidgetRegistration } from '@/lib/widgets/types'
import { config as spacerManifest } from './spacer/widget.config'
import { config as activityFeedManifest } from './activity-feed/widget.config'
import { config as headerHighlightsManifest } from './header-highlights/widget.config'
import { config as fileFolderManifest } from './file-folder/widget.config'
import { config as relatedListManifest } from './related-list/widget.config'
import { config as teamMembersRollupManifest } from './team-members-rollup/widget.config'
import HeaderHighlightsConfigPanel from './header-highlights/ConfigPanel'
import RelatedListConfigPanel from './related-list/ConfigPanel'
import TeamMembersRollupConfigPanel from './team-members-rollup/ConfigPanel'

export const internalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: spacerManifest,
    widgetConfigType: 'Spacer',
    Component: dynamic(() => import('./spacer/index')),
    transformConfig: (stored) => ({ height: (stored as any).minHeightPx ?? 32 }),
  },
  {
    manifest: activityFeedManifest,
    widgetConfigType: 'ActivityFeed',
    Component: dynamic(() => import('./activity-feed/index')),
  },
  {
    manifest: headerHighlightsManifest,
    widgetConfigType: 'HeaderHighlights',
    Component: dynamic(() => import('./header-highlights/index')),
    ConfigPanel: HeaderHighlightsConfigPanel,
  },
  {
    manifest: fileFolderManifest,
    widgetConfigType: 'FileFolder',
    Component: dynamic(() => import('./file-folder/index')),
    transformConfig: (stored) => ({ path: (stored as any).folderId ?? '' }),
  },
  {
    manifest: relatedListManifest,
    widgetConfigType: 'RelatedList',
    Component: dynamic(() => import('./related-list/index')),
    ConfigPanel: RelatedListConfigPanel,
  },
  {
    manifest: teamMembersRollupManifest,
    widgetConfigType: 'TeamMembersRollup',
    Component: dynamic(() => import('./team-members-rollup/index')),
    ConfigPanel: TeamMembersRollupConfigPanel,
  },
]

export const internalWidgets = internalWidgetRegistrations.map((r) => r.manifest)
