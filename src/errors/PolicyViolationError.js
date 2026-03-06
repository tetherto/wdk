/** @typedef {import('../wdk-manager.js').PolicyTarget} PolicyTarget */

/**
 * Error thrown when a registered policy rejects an operation.
 */
export class PolicyViolationError extends Error {
  /**
   * @param {string} policyName
   * @param {string} method
   * @param {PolicyTarget} target
   */
  constructor (policyName, method, target = {}) {
    const targetDesc = target.wallet
      ? `wallet: ${target.wallet}`
      : target.protocol
        ? `protocol: ${JSON.stringify(target.protocol)}`
        : 'global'

    super(
      `Policy "${policyName}" rejected method "${method}" for ${targetDesc}`
    )

    this.name = 'PolicyViolationError'
    /** @type {string} */
    this.policy = policyName
    /** @type {string} */
    this.method = method
    /** @type {Object} */
    this.target = target
  }
}
