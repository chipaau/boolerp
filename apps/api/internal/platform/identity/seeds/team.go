package seeds

// member is a person on the Bool team. The team's accounts are production's
// starting data (C135): cmd/deploy creates them in every environment, and in
// development the demo seeder also gives them a password and the Google stand-in.
type member struct {
	email, name, phone string
}

// team are the platform's first accounts, with the details the team gave
// (2026-10-04). Emails and phones are personal data: never logged (C94).
var team = []member{
	{"shifau@bool.mv", "Ahmed Shifau", "+9607800272"},
	{"mariyam@bool.mv", "Mariyam Ahmed", "+9609818117"},
	{"ibrahim@bool.mv", "Ibrahim Hussain Shareef", "+9607909764"},
}
