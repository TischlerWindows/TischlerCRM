import type { WidgetManifest } from '@/lib/widgets/types'
import { config as activityFeed } from './activity-feed/widget.config'
import { config as headerHighlights } from './header-highlights/widget.config'
import { config as fileFolder } from './file-folder/widget.config'
import { config as spacer } from './spacer/widget.config'
import { config as relatedList } from './related-list/widget.config'

export const internalWidgets: WidgetManifest[] = [
  activityFeed,
  headerHighlights,
  fileFolder,
  spacer,
  relatedList,
]
