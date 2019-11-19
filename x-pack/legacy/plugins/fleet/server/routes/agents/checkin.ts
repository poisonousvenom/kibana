/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import * as Joi from 'joi';
import Boom from 'boom';

import { PathReporter } from 'io-ts/lib/PathReporter';
import { isLeft } from 'fp-ts/lib/Either';
import { FrameworkRequest } from '../../adapters/framework/adapter_types';
import { ReturnTypeCheckin } from '../../../common/return_types';
import { RuntimeAgentEvent, AgentEvent } from '../../repositories/agent_events/types';
import { FleetServerLib } from '../../libs/types';

type CheckinRequest = FrameworkRequest<{
  payload: {
    events: any[];
    local_metadata: any;
  };
  params: {
    agentId: string;
  };
}>;

export const createCheckinAgentsRoute = (libs: FleetServerLib) => ({
  method: 'POST',
  path: '/api/fleet/agents/{agentId}/checkin',
  config: {
    auth: false,
    validate: {
      payload: {
        events: Joi.array().required(),
        local_metadata: Joi.object().optional(),
      },
    },
  },
  handler: async (request: CheckinRequest): Promise<ReturnTypeCheckin> => {
    const { events } = await validateAndDecodePayload(request);
    const { actions, policy } = await libs.agents.checkin(
      request.user,
      events,
      request.payload.local_metadata
    );

    return {
      action: 'checkin',
      success: true,
      policy,
      actions: actions.map(a => ({
        type: a.type,
      })),
    };
  },
});

async function validateAndDecodePayload(
  request: CheckinRequest
): Promise<{ events: AgentEvent[] }> {
  const { events: rawEvents } = request.payload;
  const events: AgentEvent[] = rawEvents.map((event, idx) => {
    const result = RuntimeAgentEvent.decode(event);
    if (isLeft(result)) {
      throw Boom.badRequest(
        `Malformed request, event ${idx} is invalid, (${PathReporter.report(result)})`
      );
    }
    return result.right;
  });

  return { events };
}