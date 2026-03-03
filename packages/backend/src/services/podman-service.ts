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
import type { PodmanExtensionApi } from '@podman-desktop/podman-extension-api';
import type { extensions as Extensions, Disposable, ProviderContainerConnection } from '@podman-desktop/api';
import { PODMAN_EXTENSION_ID } from '../utils/constants';
import type { PodmanConnection } from '../models/podman-connection';

interface Dependencies {
  extensions: typeof Extensions;
}

export class PodmanService implements Disposable {
  // smart podman extension api getter with some cache
  #podman: PodmanExtensionApi | undefined;

  constructor(protected dependencies: Dependencies) {}

  protected get podman(): PodmanExtensionApi {
    if (!this.#podman) {
      this.#podman = this.getPodmanExtension();
    }
    return this.#podman;
  }

  protected getPodmanExtension(): PodmanExtensionApi {
    const podman = this.dependencies.extensions.getExtension(PODMAN_EXTENSION_ID);
    if (!podman) throw new Error('podman extension not found');

    if (!('exec' in podman.exports) || typeof podman.exports.exec !== 'function') {
      throw new Error('invalid podman extension exports');
    }

    return podman.exports;
  }

  /**
   * Check if a given machine is rootful
   * @param connection
   */
  protected async isMachineRootful(connection: ProviderContainerConnection): Promise<boolean> {
    if (!connection.connection.vmType)
      throw new Error('connection provided is not a podman machine (native connection)');

    const result = await this.podman.exec(
      ['machine', 'inspect', '--format', '{{.Rootful}}', connection.connection.name],
      {
        connection: connection,
      },
    );
    return result.stdout.trim() === 'true';
  }

  public async findPodmanConnection(connection: ProviderContainerConnection): Promise<PodmanConnection | undefined> {
    const connections = await this.getPodmanConnections();

    let connectionName: string;
    if (connection.connection.vmType) {
      const isRootful = await this.isMachineRootful(connection);
      connectionName = `${connection.connection.name}${isRootful ? '-root' : ''}`;
    } else {
      connectionName = connection.connection.name;
    }

    return connections.find(connection => connection.Name === connectionName);
  }

  /**
   * Get podman connections
   * @remarks only ssh protocol is supported
   */
  public async getPodmanConnections(): Promise<Array<PodmanConnection>> {
    const { stdout } = await this.podman.exec(['system', 'connection', 'ls', '--format=json']);
    const connections: Array<PodmanConnection> = JSON.parse(stdout);
    // validate output
    if (!Array.isArray(connections)) throw new Error('malformed output for podman system connection ls command.');

    // filter out all machines (that are local)
    return connections.filter(connection => connection.URI.startsWith('ssh:'));
  }

  dispose(): void {
    this.#podman = undefined;
  }
}
