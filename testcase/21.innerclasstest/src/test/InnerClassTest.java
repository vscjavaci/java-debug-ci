package test;



class A {
	void m() {
		System.out.println("outer");
	}
}

public class InnerClassTest {
			
	public void test() {
		new InnerClassTest().go();

		class A {
			void m() {
				System.out.println("inner2");
			}
		}
		new A().m();
	}

	void go() {
		new A().m();
		class A {
			void m() {
				System.out.println("inner");
			}
		}
	}

	void go2() {
		new A().m();
		class A {
			void m() {
				System.out.println("inner");
			}
		}
	}

	class A {
		void m() {
			System.out.println("middle");
		}
	}
}