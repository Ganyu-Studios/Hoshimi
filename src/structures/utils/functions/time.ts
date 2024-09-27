export enum TimeUnits {
	Millisecond = 1,
	Second = 1000,
	Minute = 60 * TimeUnits.Second, // 60_000
	Hour = 60 * TimeUnits.Minute, // 3_600_000
	Day = 24 * TimeUnits.Hour, // 8_640_000
	Week = 7 * TimeUnits.Day, // 604_800_000
}

const TimeUnitsOrder = {
	ms: TimeUnits.Millisecond,
	s: TimeUnits.Second,
	m: TimeUnits.Minute,
	h: TimeUnits.Hour,
	d: TimeUnits.Day,
	w: TimeUnits.Week,
};

const createMsFormater = (isNormalMode = true, order: typeof TimeUnitsOrder = TimeUnitsOrder) => {
	const unitsLabels = Object.keys(order) as (keyof typeof order)[];
	const unitsValues = Object.values(order) as number[];

	const isDottedMode = isNormalMode === false;

	function baseFormater(time: number = 0, isChild = false): [string, number] {
		let targetPosition = 0;
		let targetUnitValue = 1;

		for (let i = 0; i < unitsValues.length; i++) {
			const unitValue = unitsValues[i]!;

			if (time < unitValue) break;

			targetPosition = i;
			targetUnitValue = unitValue;
		}

		const unitName = unitsLabels[targetPosition]!;
		const resultTime = Math.floor(time / targetUnitValue).toString();

		let more = time % targetUnitValue;
		let result = resultTime + unitName;

		if (isDottedMode) {
			if (more < 1000) more = 0;
			if (targetPosition === 0) return ["00:00", targetPosition];

			result = isChild
				? resultTime.padStart(2, "0")
				: // do 00:05
					targetPosition <= 1
					? "00:".repeat(targetPosition) + resultTime.padStart(2, "0")
					: resultTime;
		}

		if (more !== 0) {
			const [rest, pos] = baseFormater(more, true);
			if (isNormalMode) result += ` ${rest}`;
			else if (pos !== 0) {
				result += `${":00".repeat(targetPosition - pos - 1)}:${rest}`;
			}
		} else if (isDottedMode && targetPosition >= 1) {
			result += ":00".repeat(targetPosition - 1);
		}

		return [result, targetPosition];
	}

	function formater(time: undefined): void;
	function formater(time: number): string;
	function formater(time: number | undefined): string | void;
	function formater(time: number | undefined): string | void {
		if (time === undefined) return;
		return baseFormater(time)[0];
	}

	return formater;
};

/**
 * Time format utils.
 */
export const TimeFormat = {
	/**
	 * Convert milliseconds to a string format.
	 * @example "1h 4s"
	 */
	toHumanize: createMsFormater(),
	/**
	 * Convert milliseconds to a string dotted format.
	 * This not show ms.
	 * @example "1:00:04"
	 */
	toDotted: createMsFormater(false),
};

/**
 * This helper function was originally created
 * By [SagiriIkeda](https://github.com/SagiriIkeda)
 */
