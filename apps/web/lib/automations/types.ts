export interface TriggerSettingDTO {
  triggerId: string
  enabled: boolean
  name: string
  description: string
  icon: string
  objectApiName: string
  events: string[]
}

export interface ControllerSettingDTO {
  controllerId: string
  enabled: boolean
  name: string
  description: string
  icon: string
  objectApiName: string
  routePrefix: string
}
