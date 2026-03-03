/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import type { containerEngine, Disposable, ProviderContainerConnection } from '@podman-desktop/api';
import type { ProviderService } from './provider-service';

interface Dependencies {
  containers: typeof containerEngine;
  providers: ProviderService;
}

export class ContainerService implements Disposable {
  constructor(protected dependencies: Dependencies) {}

  /**
   * This method return the ContainerProviderConnection corresponding to an engineId
   * @remarks only works with running container connection
   * @param engineId
   */
  async getRunningProviderContainerConnectionByEngineId(engineId: string): Promise<ProviderContainerConnection> {
    for (const provider of this.dependencies.providers.getContainerConnections()) {
      if (provider.connection.status() !== 'started') continue;

      const infos = await this.dependencies.containers.listInfos({ provider: provider.connection });
      if (infos.length === 0) continue;

      if (infos[0].engineId === engineId) return provider;
    }
    throw new Error('connection not found');
  }

  dispose(): void {}
}
