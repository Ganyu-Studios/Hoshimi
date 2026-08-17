import { DebugLevels, EventNames, type Nullable } from "../../types/Manager";
import type { LavalinkPlayerVoice, VoiceChannelUpdate } from "../../types/Player";
import type { PlayerStructure } from "../../types/Structures";

/**
 * A type representing a partial update to the player's voice state.
 */
export type NullableVoiceChannelUpdate = Partial<Nullable<VoiceChannelUpdate>>;

/**
 * A type representing a partial update to the player's voice data.
 */
export type VoiceDataUpdate = Partial<Nullable<LavalinkPlayerVoice>>;

/**
 * Class representing the voice connection and state of a player.
 * @class PlayerVoiceState
 */
export class PlayerVoiceState {
    /**
     * The voice server endpoint.
     * @type {string | null}
     */
    public endpoint: string | null = null;

    /**
     * The voice session id.
     * @type {string | null}
     */
    public sessionId: string | null = null;

    /**
     * The voice server token.
     * @type {string | null}
     */
    public token: string | null = null;

    /**
     * The voice channel id.
     * @type {string | null}
     */
    public channelId: string | null = null;

    /**
     * Reference to the player structure this voice instance belongs to.
     * @type {PlayerStructure}
     * @readonly
     */
    public readonly player: PlayerStructure;

    /**
     *
     * Create a new PlayerVoiceState instance for a player.
     * @param {PlayerStructure} player The player structure to attach this voice instance to.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   const voice = new PlayerVoiceState(player);
     *   console.log(voice.channelId);
     * }
     * ```
     */
    constructor(player: PlayerStructure) {
        this.player = player;
    }

    /**
     * Merge voice data from Lavalink or gateway updates.
     * @param {VoiceDataUpdate} data The partial voice data to update with.
     * @returns {this} The current PlayerVoiceState instance after patching.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   player.voice.patch({
     *     sessionId: "session-id",
     *     channelId: "voice-channel-id",
     *   });
     * }
     * ```
     */
    public patch(data: VoiceDataUpdate): this {
        if (data.endpoint) this.endpoint = data.endpoint ?? null;
        if (data.sessionId) this.sessionId = data.sessionId ?? null;
        if (data.token) this.token = data.token ?? null;
        if (data.channelId) this.channelId = data.channelId ?? null;

        return this;
    }

    /**
     * Reset all voice connection values.
     * @returns {this} The current PlayerVoiceState instance.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   player.voice.reset();
     * }
     * ```
     */
    public reset(): this {
        this.endpoint = null;
        this.sessionId = null;
        this.token = null;
        this.channelId = null;

        return this;
    }

    /**
     * Return the current voice values as a nullable payload.
     * @returns {Nullable<LavalinkPlayerVoice>} The current voice data as a nullable LavalinkPlayerVoice payload.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   const voice = player.voice.toJSON();
     *   console.log(voice.endpoint);
     * }
     * ```
     */
    public toJSON(): Nullable<LavalinkPlayerVoice> {
        return {
            endpoint: this.endpoint,
            sessionId: this.sessionId,
            token: this.token,
            channelId: this.channelId,
        };
    }

    /**
     * Return a valid Lavalink voice payload when all required fields are present.
     * @returns {LavalinkPlayerVoice | null} The Lavalink voice payload or null if required fields are missing.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   const voice = player.voice.toNode();
     *   if (!voice) console.log("Voice payload is incomplete");
     * }
     * ```
     */
    public toNode(): LavalinkPlayerVoice | null {
        if (!this.endpoint || !this.sessionId || !this.token || !this.channelId) return null;

        return {
            endpoint: this.endpoint,
            sessionId: this.sessionId,
            token: this.token,
            channelId: this.channelId,
        };
    }

    /**
     * Send a voice state payload to the Discord gateway.
     * @param {NullableVoiceChannelUpdate} options The voice state options to update. Only include fields that need to be updated, others will be kept as is.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   await player.voice.setState({
     *     voiceId: "new-voice-channel-id",
     *     selfMute: false,
     *   });
     * }
     * ```
     */
    public async setState(options: NullableVoiceChannelUpdate = {}): Promise<void> {
        const voiceId: string | undefined = options.voiceId ?? this.player.voiceId;
        const selfDeaf: boolean = options.selfDeaf ?? this.player.selfDeaf;
        const selfMute: boolean = options.selfMute ?? this.player.selfMute;

        this.player.voiceId = voiceId;
        this.player.selfDeaf = selfDeaf;
        this.player.selfMute = selfMute;
        this.channelId = voiceId ?? null;

        if (voiceId) this.player.options.voiceId = voiceId;

        await this.player.manager.options.sendPayload(this.player.guildId, {
            op: 4,
            d: {
                guild_id: this.player.guildId,
                self_deaf: selfDeaf,
                self_mute: selfMute,
                channel_id: voiceId ?? null,
            },
        });

        this.player.manager.debug(
            DebugLevels.Player,
            `[Player] -> [VoiceState] Updated voice state for guild: ${this.player.guildId} with voiceId: ${voiceId}`,
        );
    }

    /**
     * Connect the player to its configured voice channel.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   await player.voice.connect();
     * }
     * ```
     */
    public async connect(): Promise<void> {
        if (this.player.connected) return;
        if (!this.player.voiceId) return;

        await this.setState();

        this.player.manager.debug(DebugLevels.Player, `[Player] -> [Connect] Player connected for guild: ${this.player.guildId}`);

        this.player.connected = true;
    }

    /**
     * Disconnect the player from voice.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   await player.voice.disconnect();
     * }
     * ```
     */
    public async disconnect(): Promise<void> {
        if (!this.player.voiceId) return;

        this.player.voiceId = undefined;

        await this.setState({ voiceId: undefined });

        this.player.manager.debug(DebugLevels.Player, `[Player] -> [Disconnect] Player disconnected for guild: ${this.player.guildId}`);

        this.player.manager.emit(EventNames.PlayerDisconnect, this.player);

        this.player.connected = false;
    }

    /**
     * Move the player to another voice channel.
     * @param {string} voiceId The id of the voice channel to move to.
     * @returns {Promise<PlayerStructure>} The player structure after moving.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   await player.voice.move("target-voice-channel-id");
     * }
     * ```
     */
    public async move(voiceId: string): Promise<PlayerStructure> {
        const oldChannelId: string | undefined = this.player.voiceId;
        await this.setState({ voiceId });

        this.player.manager.debug(
            DebugLevels.Player,
            `[Player] -> [VoiceMove] Player moved from channel: ${oldChannelId} to: ${voiceId} for guild: ${this.player.guildId}`,
        );

        if (oldChannelId && voiceId !== oldChannelId) {
            this.player.manager.emit(EventNames.PlayerMove, this.player, oldChannelId, voiceId);
        }

        return this.player;
    }

    /**
     * Toggle or set self mute.
     * @param {boolean} selfMute Whether to self mute or not. Defaults to toggling the current state.
     * @returns {Promise<PlayerStructure>} The player structure after updating mute state.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   await player.voice.mute(true);
     * }
     * ```
     */
    public async mute(selfMute: boolean = !this.player.selfMute): Promise<PlayerStructure> {
        await this.setState({ selfMute });
        return this.player;
    }

    /**
     * Toggle or set self deaf.
     * @param {boolean} selfDeaf Whether to self deafen or not. Defaults to toggling the current state.
     * @returns {Promise<PlayerStructure>} The player structure after updating deafen state.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * if (player) {
     *   await player.voice.deaf(true);
     * }
     * ```
     */
    public async deaf(selfDeaf: boolean = !this.player.selfDeaf): Promise<PlayerStructure> {
        await this.setState({ selfDeaf });
        return this.player;
    }
}
