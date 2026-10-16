import { activityValidationRepository } from '../repositories/activityValidationRepository'

export const activityValidationService = {
  listPending: () => activityValidationRepository.listPending(),
  validate: (id: string) => activityValidationRepository.validate(id),
  reject: (id: string, reason: string) => activityValidationRepository.reject(id, reason),
}
