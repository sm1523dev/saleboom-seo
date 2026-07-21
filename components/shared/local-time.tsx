"use client";

type Props = {
  date: Date | string | number;
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
};

export function LocalTime({ date, dateStyle = "short", timeStyle }: Props) {
  return (
    <>
      {new Intl.DateTimeFormat("en", { dateStyle, timeStyle }).format(new Date(date))}
    </>
  );
}
